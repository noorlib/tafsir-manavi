/* ============================================================
   Tafsir Manavi — Service Worker
   ============================================================ */

// ⚠️ هر بار فایل‌های اپ (HTML/CSS/JS) تغییر کرد، این رو بامپ کن
const APP_VERSION = '1.0.1';

const CACHE_APP  = 'tafsir-manavi-app-v' + APP_VERSION;
const CACHE_DATA = 'tafsir-manavi-data';

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

/* ---------------- پیام skipWaiting ---------------- */
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

  /* --- sw.js: همیشه از شبکه --- */
  if (url.pathname.endsWith('/sw.js')) {
    e.respondWith(fetch(url.origin + url.pathname, { cache: 'no-store' }));
    return;
  }

  /* --- JSON: سه حالت --- */
  if (url.pathname.endsWith('.json')) {
    const cleanUrl = url.origin + url.pathname;
    const checkOnly = url.searchParams.get('check') === '1';
    const refresh   = url.searchParams.get('refresh') === '1';

    // فقط چک نسخه — شبکه، بدون دست زدن به کش
    if (checkOnly) {
      e.respondWith(fetch(cleanUrl, { cache: 'no-store' }));
      return;
    }

    // بروزرسانی واقعی — شبکه + ذخیره در کش
    if (refresh) {
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

    // عادی — cache-first
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

  /* --- HTML --- */
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

  /* --- بقیه --- */
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