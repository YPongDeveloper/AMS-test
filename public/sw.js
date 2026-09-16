// SRT Asset Management - Service Worker
// หลักการ: หน้าเว็บ (navigation) ใช้ network-first เสมอ เพื่อไม่ให้เห็น HTML เก่า
// (HTML เก่าชี้ไฟล์ CSS/JS hash เก่าที่ถูกลบหลัง deploy = หน้าเว็บไม่มีสไตล์)
// ไฟล์ static (_next/static, ไอคอน) ใช้ cache-first เพราะชื่อไฟล์มี hash เปลี่ยนทุก build
const CACHE = 'srt-asset-v3';
const PRECACHE = ['/manifest.json', '/icon-192.png', '/icon-512.png', '/favicon.ico'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
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
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API ภายนอกไม่แตะ

  // 1) หน้าเว็บ (navigation) — network-first, offline ค่อยใช้ cache
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/')))
    );
    return;
  }

  // 2) static assets — cache-first (stale-while-revalidate)
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icon') || url.pathname === '/favicon.ico') {
    e.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(request, clone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetched;
      })
    );
    return;
  }

  // 3) อื่น ๆ (manifest ฯลฯ) — network-first
  e.respondWith(
    fetch(request)
      .catch(() => caches.match(request).then((c) => c || Response.error()))
  );
});

// 4) Background Sync: ซิงค์ข้อมูลงานที่ค้างไว้ในเบื้องหลังเมื่อมีอินเทอร์เน็ต
self.addEventListener('sync', (event) => {
  if (event.tag === 'ams-sync-tasks') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' });
        });
      })
    );
  }
});

// 5) Notification Click: เมื่อผู้ใช้กดที่การแจ้งเตือน ให้เปิดหรือสลับมาที่แอป
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/tasks');
      }
    })
  );
});

