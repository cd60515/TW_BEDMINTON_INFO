// 台灣羽球通 Service Worker
// App shell：cache-first（版本號變更即更新）；資料 JSON：network-first，離線時用快取
const VERSION = 'twb-2026-11-06-overture';
const SHELL = ['./', 'index.html', 'assets/css/app.css', 'assets/js/app.js', 'assets/js/core.js', 'assets/js/views.js', 'assets/js/mascot.js', 'assets/js/icons.js',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'assets/img/icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/data/')) {
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone(); caches.open(VERSION + '-data').then((c) => c.put(e.request, copy)); return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return r;
  })));
});
