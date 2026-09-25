const CACHE_NAME = 'tafsir-manavi-v1';

// فایل‌های اصلی (بدون JSON سنگین)
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './bootstrap.rtl.min.css',
  './shabnam-500.woff2',
  './icon/tm-64.png',
  './icon/tm-128.png',
  './icon/tm-256.png',
  './icon/tm-512.png'
];

// نصب
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// فعال‌سازی
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (e) => {
  // فقط GET رو کش کن
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // فقط درخواست‌های هم‌دامنه
  if (url.origin !== location.origin) return;

  // JSON سنگین: cache-first با ذخیره در پس‌زمینه
  if (url.pathname.endsWith('.json')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // بقیه: cache-first با fallback به شبکه
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});