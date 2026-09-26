/* ============================================================
   Tafsir Manavi — Service Worker
   - آفلاین‌فرست: همه چیز cache-first
   - دو کش: app (نسخه‌دار) + data (بدون نسخه، زنده می‌مونه)
   ============================================================ */

// ⚠️ هر بار اپ رو تغییر دادی، APP_VERSION رو بامپ کن
// ⚠️ هر بار فایل JSON رو تغییر دادی، DATA_VERSION رو بامپ کن
const APP_VERSION  = '1.0.1';
const DATA_VERSION = '1.0.1';

const CACHE_APP  = 'tafsir-manavi-app-v' + APP_VERSION;
const CACHE_DATA = 'tafsir-manavi-data';  // بدون نسخه — موقع آپدیت اپ پاک نمی‌شه

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

/* ---------------- نصب ---------------- */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_APP)
      .then(c => c.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ---------------- فعال‌سازی ---------------- */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      const keep = [CACHE_APP, CACHE_DATA];
      return Promise.all(
        keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

/* ---------------- پیام از صفحه (skipWaiting) ---------------- */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---------------- Fetch ---------------- */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  /* --- درخواست sw.js (برای چک نسخه): همیشه از شبکه --- */
  if (url.pathname.endsWith('/sw.js')) {
    e.respondWith(fetch(url.origin + url.pathname, { cache: 'no-store' }));
    return;
  }

  /* --- JSON داده‌ها --- */
  if (url.pathname.endsWith('.json')) {
    // مسیر کانونیک (بدون query)
    const cleanUrl = url.origin + url.pathname;

    // درخواست refresh: شبکه + به‌روزرسانی کش
    if (url.searchParams.get('refresh') === '1') {
      e.respondWith(
        fetch(cleanUrl, { cache: 'no-store' }).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_DATA).then(c => c.put(cleanUrl, clone));
          }
          return res;
        }).catch(() => caches.match(cleanUrl))
      );
      return;
    }

    // حالت عادی: cache-first
    e.respondWith(
      caches.match(cleanUrl).then(cached => {
        if (cached) return cached;
        return fetch(cleanUrl).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_DATA).then(c => c.put(cleanUrl, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  /* --- HTML: cache-first با fallback --- */
  if (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        return cached || fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_APP).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  /* --- بقیه (CSS/font/icon/manifest): cache-first --- */
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_APP).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});