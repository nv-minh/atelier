/* Atelier service worker — installability + offline resilience.
 * Hand-rolled, no build step. Bump CACHE_VERSION on any breaking change
 * to the precache set or caching rules (see DEPLOY.md). */

const CACHE_VERSION = "atelier-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;

// Precached at install so the offline fallback works on first outage.
const PRECACHE = ["/offline"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; let the browser deal with POST/PUT/etc. untouched.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Ignore non-http(s) schemes (chrome-extension:, data:, etc.).
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // AUTH SAFETY: never touch the API — especially /api/auth/*. These carry
  // session state and must always hit the network. respondWith is skipped
  // entirely so the request passes through unmodified.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigations: network-first, fall back to the cached /offline page.
  // AUTH SAFETY: navigation responses are NEVER cached — auth-dependent HTML
  // must not be served stale (a logged-out user must not see a cached
  // logged-in shell).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(PAGES_CACHE).then((cache) => cache.match("/offline"))
      )
    );
    return;
  }

  // Immutable, hash-named static assets (self-hosted fonts live under
  // /_next/static too): cache-first, then network, caching successful gets.
  const isStatic =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/fonts/"));

  if (isStatic) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
        )
      )
    );
    return;
  }

  // Everything else: pass through (no respondWith).
});
