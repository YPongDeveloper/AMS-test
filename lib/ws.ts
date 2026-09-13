// WebSocket client — เชื่อมหลังบ้านแบบ realtime (reconnect อัตโนมัติ)
import { wsUrl, type Task } from "./api";

export interface WSEvent {
  type: "task.new" | "task.update";
  task: Task;
}

export function connectTaskWS(onEvent: (e: WSEvent) => void, onStatus?: (connected: boolean) => void): () => void {
  const url = wsUrl();
  if (!url) return () => {};

  let ws: WebSocket | null = null;
  let closed = false;
  let retryMs = 2000;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleRetry();
      return;
    }
    ws.onopen = () => {
      retryMs = 2000;
      onStatus?.(true);
    };
    ws.onmessage = (ev) => {
      try {
        onEvent(JSON.parse(ev.data as string) as WSEvent);
      } catch {
        /* ignore bad frame */
      }
    };
    ws.onclose = () => {
      onStatus?.(false);
      scheduleRetry();
    };
    ws.onerror = () => {
      try {
        ws?.close();
      } catch {
        /* noop */
      }
    };
  };

  const scheduleRetry = () => {
    if (closed || timer) return;
    timer = setTimeout(() => {
      timer = null;
      retryMs = Math.min(retryMs * 2, 30000);
      connect();
    }, retryMs);
  };

  connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    try {
      ws?.close();
    } catch {
      /* noop */
    }
  };
}
