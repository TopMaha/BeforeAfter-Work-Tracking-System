/* Before/After Work Tracking — Service Worker (network-first, always fresh online) */
const CACHE = 'ba-track-v20';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/')) return;           // API: ไม่แตะ (ออนไลน์เสมอ)
  // network-first: เอาของล่าสุดจากเน็ตเสมอ, ถ้าออฟไลน์ค่อยใช้แคช
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200 && request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
