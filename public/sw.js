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

// 4) Background Sync: ซิงค์ข้อมูลงานที่ค้างไว้ในเบื้องหลัง แม้ตอนผู้ใช้ออกจากแอปไปแล้ว
const DB_NAME = 'ams_offline_db';
const STORE_NAME = 'offline_queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllQueueItems(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function deleteQueueItem(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

let isSyncingInBackground = false;

async function processBackgroundSync() {
  if (isSyncingInBackground) return;
  isSyncingInBackground = true;

  try {
    const db = await openDB();
    const items = await getAllQueueItems(db);
    if (!items || items.length === 0) {
      isSyncingInBackground = false;
      return;
    }

    let synced = 0;
    for (const item of items) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (item.token) {
          headers['Authorization'] = `Bearer ${item.token}`;
        }

        let res = null;
        if (item.type === 'status' && item.status) {
          const endpoint = (item.apiUrl || '') + `/api/tasks/${item.taskId}/status`;
          res = await fetch(endpoint, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: item.status }),
          });
        } else if (item.type === 'submission' && item.submissionPayload) {
          const endpoint = (item.apiUrl || '') + `/api/tasks/${item.taskId}/submit`;
          res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(item.submissionPayload),
          });
        }

        // หากสำเร็จ หรือข้อมูลไม่พบแล้ว ให้ลบออกจากคิว
        if (res && (res.ok || res.status === 404)) {
          await deleteQueueItem(db, item.id);
          if (res.ok) synced++;
        }
      } catch (err) {
        console.warn('[SW BackgroundSync] Network error syncing item:', item.id, err);
      }
    }

    if (synced > 0) {
      // ส่งการแจ้งเตือนระดับ OS บนมือถือทันที โดยสัญลักษณ์เป็นรูปโลโก้ และไม่มีรูปโลโก้ขนาดใหญ่ในกล่องข้อความ
      if (self.registration && 'showNotification' in self.registration) {
        await self.registration.showNotification("ซิงค์ข้อมูลสำเร็จ", {
          body: `ข้อมูลงานสำรวจที่บันทึกไว้ขณะออฟไลน์ (${synced} รายการ) ได้รับการบันทึกเข้าสู่ระบบเรียบร้อยแล้ว`,
          badge: "/icon-192.png",
          tag: "ams-sync-complete",
          data: { url: "/tasks" },
        });
      }

      // ส่งสัญญาณบอก Window (ถ้ามีเปิดอยู่)
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((c) => {
        c.postMessage({ type: 'AMS_OFFLINE_SYNCED', synced });
      });
    }
  } catch (err) {
    console.warn('[SW BackgroundSync] Error in processBackgroundSync:', err);
  } finally {
    isSyncingInBackground = false;
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'ams-sync-tasks') {
    event.waitUntil(processBackgroundSync());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'ams-sync-tasks-periodic' || event.tag === 'ams-sync-tasks') {
    event.waitUntil(processBackgroundSync());
  }
});

// 5) Push Notification: เมื่อมีงานใหม่เข้ามาแม้ไม่ได้เปิดแอป
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "งานสำรวจใหม่", body: event.data ? event.data.text() : "คุณได้รับมอบหมายงานสำรวจใหม่" };
  }

  const title = payload.title || "งานสำรวจใหม่";
  const body = payload.body || "คุณได้รับมอบหมายงานสำรวจใหม่";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      badge: "/icon-192.png",
      tag: payload.tag || "ams-new-task",
      data: { url: payload.url || "/tasks" },
    })
  );
});

// 6) Notification Click: เมื่อผู้ใช้กดที่การแจ้งเตือน ให้เปิดหรือสลับมาที่แอป
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/tasks';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

