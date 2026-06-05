const CACHE_NAME = 'school-attendance-v1';
const APP_SHELL = [
  './',
  './index.html',
  './dashboard.html',
  './add-students.html',
  './analytics.html',
  './mark-attendance.html',
  './marks.html',
  './top-bunkers.html',
  './school-setup.html',
  './school-admin.html',
  './teachers-manage.html',
  './classes-manage.html',
  './subjects-manage.html',
  './teacher-assignments.html',
  './style.css',
  './script.js',
  './marks.js',
  './sidebar.js',
  './theme.js',
  './toast.js',
  './security.js',
  './audit.js',
  './school-service.js',
  './school-setup.js',
  './school-admin.js',
  './teachers-manage.js',
  './classes-manage.js',
  './subjects-manage.js',
  './teacher-assignments.js',
  './firebase.js',
  './auth-check.js',
  './file_000000000b80720891a13f8f2b0b0935.png',
  './offline.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./offline.html'));
    })
  );
});