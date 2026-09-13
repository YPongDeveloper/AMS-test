// API client สำหรับระบบสั่งงาน — ตั้งค่า NEXT_PUBLIC_API_URL เพื่อเปิดใช้งาน

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
export const API_CONFIGURED = API_URL.length > 0;

export type Role = "supervisor" | "subordinate";

export interface AppUser {
  id: number;
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
  role: Role;
  created_at: string;
}

export type TaskStatus = "pending" | "accepted" | "in_progress" | "done" | "cancelled";

export interface Task {
  id: number;
  code: string | null;
  title: string;
  task_type: "survey" | "inspect" | "other";
  description: string;
  status: TaskStatus;
  assigned_to: number;
  assignee_name: string;
  assigned_by: number;
  assigner_name: string;
  due_at: string | null;
  lat: number | null;
  lng: number | null;
  place_name: string | null;
  created_at: string;
  updated_at: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = "ams_api_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string) {
  window.localStorage.setItem(TOKEN_KEY, t);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  if (!API_CONFIGURED) throw new ApiError("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL", 0);
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body = init?.body;
  if (init && "json" in init && init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(API_URL + path, { ...init, headers, body });
  if (res.status === 401) clearToken();
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data as { error?: string })?.error || `HTTP ${res.status}`, res.status);
  return data as T;
}

// แลก LINE ID Token (จาก LIFF) เป็นบัญชี + token ของระบบ
export async function loginWithLineIdToken(idToken: string): Promise<{ token: string; user: AppUser }> {
  const data = await api<{ token: string; user: AppUser }>("/api/auth/line", {
    method: "POST",
    json: { id_token: idToken },
  });
  setToken(data.token);
  return data;
}

export function wsUrl(): string | null {
  if (!API_CONFIGURED) return null;
  return API_URL.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(getToken() || "");
}

// ---- labels ----

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "รอรับงาน",
  accepted: "รับงานแล้ว",
  in_progress: "กำลังปฏิบัติงาน",
  done: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

export const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-sky-100 text-sky-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  done: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

export const TYPE_LABEL: Record<string, string> = {
  survey: "งานเก็บข้อมูล",
  inspect: "งานตรวจสอบ",
  other: "งานอื่น ๆ",
};

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " น.";
}
