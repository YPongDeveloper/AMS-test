import {
  api,
  submitTaskData,
  type TaskStatus,
  type TaskSubmissionPayload,
  notifyDataUpdated,
  getAccessToken,
  API_URL,
} from "./api";

export interface OfflineQueueItem {
  id: string;
  type: "status" | "submission";
  taskId: string;
  taskTitle: string;
  status?: TaskStatus;
  submissionPayload?: TaskSubmissionPayload;
  timestamp: number;
  token?: string | null;
  apiUrl?: string;
}

const OFFLINE_QUEUE_KEY = "ams_offline_task_queue_v1";
const DB_NAME = "ams_offline_db";
const STORE_NAME = "offline_queue";

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveItemToIdb(item: OfflineQueueItem): Promise<void> {
  try {
    const db = await openIdb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(item);
  } catch (err) {
    console.warn("saveItemToIdb failed:", err);
  }
}

export async function removeItemFromIdb(id: string): Promise<void> {
  try {
    const db = await openIdb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
  } catch (err) {
    console.warn("removeItemFromIdb failed:", err);
  }
}

export async function clearIdbQueue(): Promise<void> {
  try {
    const db = await openIdb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
  } catch (err) {
    console.warn("clearIdbQueue failed:", err);
  }
}

export async function getAllIdbQueue(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export function isDeviceOnline(): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

export function getOfflineQueue(): OfflineQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Failed to parse offline task queue:", err);
  }
  return [];
}

export function saveOfflineQueue(queue: OfflineQueueItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("ams_offline_queue_changed", { detail: { count: queue.length } }));
  } catch (err) {
    console.error("Failed to save offline task queue:", err);
  }
}

export async function registerBackgroundSync(): Promise<void> {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "sync" in reg) {
        await (reg as any).sync.register("ams-sync-tasks");
      }
      if (reg && "periodicSync" in reg) {
        await (reg as any).periodicSync
          .register("ams-sync-tasks-periodic", { minInterval: 60 * 1000 })
          .catch(() => {});
      }
    } catch (err) {
      console.warn("Background Sync registration failed:", err);
    }
  }
}

export function enqueueOfflineItem(item: Omit<OfflineQueueItem, "id" | "timestamp">): OfflineQueueItem {
  const current = getOfflineQueue();
  // ถ้าเป็น status ของ taskId เดียวกันที่ค้างอยู่ ให้ update หรือแทนที่ด้วยอันล่าสุด
  let updated = current;
  if (item.type === "status") {
    updated = current.filter((q) => !(q.taskId === item.taskId && q.type === "status"));
  }
  const newItem: OfflineQueueItem = {
    ...item,
    id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    token: item.token || getAccessToken(),
    apiUrl: API_URL,
  };
  updated.push(newItem);
  saveOfflineQueue(updated);
  saveItemToIdb(newItem).catch(() => {});
  registerBackgroundSync().catch(() => {});
  return newItem;
}

export function removeOfflineItem(id: string): void {
  const current = getOfflineQueue();
  const filtered = current.filter((q) => q.id !== id);
  saveOfflineQueue(filtered);
  removeItemFromIdb(id).catch(() => {});
}

export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
  clearIdbQueue().catch(() => {});
}

let syncing = false;

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  if (!isDeviceOnline()) return { synced: 0, failed: 0 };

  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  syncing = true;
  let synced = 0;
  let failed = 0;
  const remaining: OfflineQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === "status" && item.status) {
        await api(`/api/tasks/${item.taskId}/status`, {
          method: "PATCH",
          json: { status: item.status },
        });
        await removeItemFromIdb(item.id);
        synced++;
      } else if (item.type === "submission" && item.submissionPayload) {
        await submitTaskData(item.taskId, item.submissionPayload);
        await removeItemFromIdb(item.id);
        synced++;
      } else {
        // Invalid item format, drop it
        await removeItemFromIdb(item.id);
      }
    } catch (err) {
      console.warn(`Failed to sync offline item ${item.id} for task ${item.taskId}:`, err);
      failed++;
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  syncing = false;

  if (synced > 0) {
    notifyDataUpdated();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ams_offline_synced", {
          detail: { synced, remainingCount: remaining.length },
        })
      );
    }
  }

  return { synced, failed };
}

// ตรวจจับเมื่อ Service Worker ทำการซิงค์ข้อมูลสำเร็จในเบื้องหลัง (แม้ตอนผู้ใช้ออกจากแอปไปแล้ว)
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "AMS_OFFLINE_SYNCED") {
      getAllIdbQueue().then((remaining) => {
        saveOfflineQueue(remaining);
        notifyDataUpdated();
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("ams_offline_synced", {
              detail: { synced: event.data.synced || 1, remainingCount: remaining.length },
            })
          );
        }
      });
    }
  });
}
