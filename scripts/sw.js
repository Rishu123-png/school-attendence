/* ============================================================
   SERVICE WORKER — School OS PWA
   Caches key pages for offline use
   ============================================================ */
const CACHE_NAME = "school-os-v2";
const STATIC_URLS = [
  "./",
  "./index.html",
  "./teacher-home.html",
  "./period-attendance.html",
  "./teacher-schedule.html",
  "./marks.html",
  "./top-bunkers.html",
  "./styles/main.css",
  "./scripts/app-shell.js",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  /* Network first, fallback to cache for HTML */
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then(r => r || caches.match("./index.html"))
      )
    );
    return;
  }
  /* Cache first for static assets */
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
