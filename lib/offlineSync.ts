import { api, submitTaskData, type TaskStatus, type TaskSubmissionPayload, notifyDataUpdated } from "./api";

export interface OfflineQueueItem {
  id: string;
  type: "status" | "submission";
  taskId: string;
  taskTitle: string;
  status?: TaskStatus;
  submissionPayload?: TaskSubmissionPayload;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = "ams_offline_task_queue_v1";

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
  };
  updated.push(newItem);
  saveOfflineQueue(updated);
  return newItem;
}

export function removeOfflineItem(id: string): void {
  const current = getOfflineQueue();
  const filtered = current.filter((q) => q.id !== id);
  saveOfflineQueue(filtered);
}

export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
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
        synced++;
      } else if (item.type === "submission" && item.submissionPayload) {
        await submitTaskData(item.taskId, item.submissionPayload);
        synced++;
      } else {
        // Invalid item format, drop it
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
