/**
 * Marlowe service worker — hand-written and build-pipeline independent.
 *
 * Why hand-written? Marlowe is deployed via two different build pipelines:
 *   1. the real Vite build (CI), and
 *   2. Marlowe's own in-browser esbuild-wasm build (used for nsite deploys).
 * A build-plugin-generated worker (vite-plugin-pwa/Workbox) only exists in
 * pipeline 1. This static file is copied verbatim by BOTH pipelines
 * (public/ → dist/), so offline support works no matter how the app was built.
 *
 * Strategy
 * --------
 * Because output filenames are content-hashed (main-<hash>.js) and unknown at
 * authoring time, precaching happens at RUNTIME:
 *   - install: caches the app shell entry (scope root)
 *   - fetch:   same-origin GET requests populate the cache as they happen
 *   - message: the client posts CACHE_RESOURCES with the URLs it already
 *              loaded (performance resource timing), so even the very first
 *              visit — which ran before the SW controlled the page — gets
 *              cached after the fact.
 *
 * Resilience guarantees (the whole point of this file):
 *   - Navigations are network-first, but ANY failure (offline, DNS, HTTP 502
 *     from a dying hoster) falls back to the cached index.html. The installed
 *     app is never replaced by an error page.
 *   - Only `response.ok` responses are ever cached — error pages are never
 *     stored.
 *  - version.json is never cached and never intercepted: it must always
 *    reflect the server's true state for the fail-safe update check.
 *  - CHANGELOG.md is network-first with a cache fallback, so release notes are
 *    fresh after deployments but remain readable offline.
 *  - Updates only activate when the user confirms them: the client posts
 *     {type: 'SKIP_WAITING'} and this worker stays `waiting` until then.
 */

const CACHE_NAME = 'marlowe-runtime-v1';

/** Base URL of this worker's scope (e.g. "https://host/" or "https://host/subpath/"). */
const BASE = () => self.registration.scope;

/** Requests that must always hit the network (never cached, never intercepted). */
const NEVER_CACHE_PATHS = [/\/version\.json$/];

/** Release notes: fresh online, with the last good copy available offline. */
const NETWORK_FIRST_PATHS = [/\/CHANGELOG\.md$/];

self.addEventListener('install', (event) => {
  // Cache the app shell entry. Individual failures are non-fatal: runtime
  // caching fills the gaps on subsequent loads.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(BASE()))
      .catch(() => {}),
  );
  // Deliberately NO self.skipWaiting() here — updates wait for user consent.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches left behind by older SW generations (incl. legacy Workbox
      // caches from the vite-plugin-pwa era).
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    // User approved the update → activate this waiting worker.
    self.skipWaiting();
    return;
  }

  if (data.type === 'CACHE_RESOURCES' && Array.isArray(data.urls)) {
    event.waitUntil(cacheResources(data.urls));
  }
});

/** Fetch-and-cache a list of URLs (best effort, ignores failures). */
async function cacheResources(urls) {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.origin !== self.location.origin) return;
        if (NEVER_CACHE_PATHS.some((re) => re.test(parsed.pathname))) return;
        const existing = await cache.match(url);
        if (existing) return;
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch {
        // Individual resource failed — fine, we'll catch it next time.
      }
    }),
  );
}

/** Content-hashed bundle filenames like "main-QVDLBMKU.js" are immutable. */
function isHashedAsset(pathname) {
  return /-[0-9a-zA-Z_-]{6,}\.(js|mjs|css|wasm|png|webp|svg|ico|woff2?|mp3)$/.test(
    pathname,
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let cross-origin pass through
  if (NEVER_CACHE_PATHS.some((re) => re.test(url.pathname))) return; // network-only

  // ── SPA navigations: network-first with cache fallback ──────────────
  // Fresh content when the server is healthy; the cached app shell when it
  // is down (HTTP 502 & friends) or the device is offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request);
          if (response.ok) {
            // Refresh the cached app shell with the latest version.
            await cache.put(BASE(), response.clone());
            return response;
          }
          // Server answered with an error (502, 503, …) → serve cached app.
          const cached = await cache.match(BASE());
          return cached || response;
        } catch {
          // Offline / network failure → serve cached app.
          const cached = await cache.match(BASE());
          if (cached) return cached;
          throw new Error('Offline and no cached app shell available');
        }
      })(),
    );
    return;
  }

  // ── Release notes: network-first with offline fallback ───────────────
  if (NETWORK_FIRST_PATHS.some((re) => re.test(url.pathname))) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response.clone());
            return response;
          }
          const cached = await cache.match(request);
          return cached || response;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw new Error('Offline and no cached changelog available');
        }
      })(),
    );
    return;
  }

  // ── Content-hashed assets: cache-first (immutable) ──────────────────
  if (isHashedAsset(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  // ── Everything else same-origin: stale-while-revalidate ─────────────
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  event.waitUntil(networkPromise.then(() => {}));
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await networkPromise;
      if (response && (response.ok || response.type === 'opaque')) return response;
      throw new Error('Offline and resource not cached');
    })(),
  );
});
