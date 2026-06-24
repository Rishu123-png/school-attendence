// public/sw.js — updated to prevent stale-cache problems
// Bump CACHE_VERSION on every deploy. The activate step deletes any
// cache that doesn't match, so old users automatically get flushed.

const CACHE_VERSION = "school-os-v3"; // <- was v1; bumped to purge old caches
const CACHE_NAME = CACHE_VERSION;

const BASE = self.registration.scope;
const INDEX_URL = new URL("index.html", BASE).href;
const PRECACHE_URLS = [BASE, INDEX_URL];

// Install: precache the app shell only.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting(); // new SW activates immediately
});

// Activate: delete ALL old caches so stale code can't survive a deploy.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => {
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim(); // take control of open tabs immediately
});

// Fetch: network-first for navigations (so users always get the newest HTML
// and therefore the newest hashed JS bundles). Cache-first fallback offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (!req.url.startsWith("http")) return;

  // Navigations (HTML page loads) → always try network first.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return response;
        })
        .catch(() =>
          caches.match(req).then((c) => c || caches.match(BASE) || caches.match(INDEX_URL))
        )
    );
    return;
  }

  // Other assets → cache-first, fall back to network, then cache new response.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
