export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission !== "denied") {
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch {
      return false;
    }
  }
  return false;
}

export async function showMobileNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    const granted = await requestNotificationPermission();
    if (!granted) return;
  }

  const defaultOptions: NotificationOptions = {
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    ...options,
  };

  // 1. ลองใช้ Service Worker Registration ก่อน (สำหรับ PWA บนมือถือ)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, defaultOptions);
        return;
      }
    } catch (err) {
      console.warn("ServiceWorker showNotification failed, falling back to Notification API:", err);
    }
  }

  // 2. Fallback ใช้ Window Notification API ทั่วไป
  try {
    new Notification(title, defaultOptions);
  } catch (err) {
    console.warn("Notification API failed:", err);
  }
}

// 1. แจ้งเตือนเมื่อได้รับการมอบหมายงานใหม่
export function notifyTaskAssigned(taskTitle: string, assignerName?: string): void {
  const body = assignerName
    ? `คุณได้รับมอบหมายงานสำรวจ: ${taskTitle} โดย ${assignerName}`
    : `คุณได้รับมอบหมายงานสำรวจ: ${taskTitle}`;
  showMobileNotification("งานสำรวจใหม่", {
    body,
    tag: "ams-new-task",
  });
}

// 2. แจ้งเตือนเมื่อการซิงค์ข้อมูลออฟไลน์เสร็จสมบูรณ์
export function notifySyncComplete(syncedCount: number): void {
  showMobileNotification("ซิงค์ข้อมูลสำเร็จ", {
    body: `ข้อมูลงานสำรวจที่บันทึกไว้ขณะออฟไลน์ (${syncedCount} รายการ) ได้รับการบันทึกเข้าสู่ระบบเรียบร้อยแล้ว`,
    tag: "ams-sync-complete",
  });
}
