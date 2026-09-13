// API client สำหรับระบบสั่งงาน — ตั้งค่า NEXT_PUBLIC_API_URL เพื่อเปิดใช้งาน
// Response envelope: { status, message, data } — api() คืน data เสมอ
// Token: JWT access (15 นาที) + refresh (30 วัน) — ต่ออายุอัตโนมัติเมื่อโดน 401

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
export const API_CONFIGURED = API_URL.length > 0;

export type Role = "supervisor" | "subordinate";

export interface AppUser {
  public_id: string;
  display_name: string;
  picture_url: string | null;
  role: Role;
  created_at: string;
}

export type TaskStatus = "pending" | "accepted" | "in_progress" | "done" | "cancelled";

export interface Task {
  public_id: string;
  code: string | null;
  title: string;
  task_type: "survey" | "inspect" | "other";
  description: string;
  status: TaskStatus;
  assignee_public_id: string;
  assignee_name: string;
  assigner_public_id: string;
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

const ACCESS_KEY = "ams_access_token";
const REFRESH_KEY = "ams_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

function saveTokens(access: string, refresh: string) {
  window.localStorage.setItem(ACCESS_KEY, access);
  window.localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface Envelope<T> {
  status: number;
  message: string;
  data: T | null;
}

let refreshing: Promise<boolean> | null = null;

// ต่ออายุ access token ด้วย refresh token (single-flight)
async function refreshTokens(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(API_URL + "/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return false;
      const env = (await res.json()) as Envelope<{ token: TokenPair; user: AppUser }>;
      if (!env.data?.token) return false;
      saveTokens(env.data.token.access_token, env.data.token.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  if (!API_CONFIGURED) throw new ApiError("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL", 0);

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let body = init?.body;
    if (init && "json" in init && init.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.json);
    }
    return fetch(API_URL + path, { ...init, headers, body });
  };

  let res = await doFetch();

  // access token หมดอายุ → ต่ออายุแล้วลองอีกครั้งเดียว
  if (res.status === 401 && getRefreshToken()) {
    const ok = await refreshTokens();
    if (ok) res = await doFetch();
  }
  if (res.status === 401) clearTokens();

  const env = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok) {
    throw new ApiError(env?.message || `HTTP ${res.status}`, res.status);
  }
  return env?.data as T;
}

// แลก LINE ID Token (จาก LIFF) เป็นบัญชี + token pair
export async function loginWithLineIdToken(idToken: string): Promise<AppUser> {
  const data = await api<{ user: AppUser; token: TokenPair }>("/api/auth/line", {
    method: "POST",
    json: { id_token: idToken },
  });
  if (data?.token) saveTokens(data.token.access_token, data.token.refresh_token);
  return data.user;
}

export async function logout() {
  const rt = getRefreshToken();
  if (rt && API_CONFIGURED) {
    try {
      await api("/api/auth/logout", { method: "POST", json: { refresh_token: rt } });
    } catch {
      /* ignore */
    }
  }
  clearTokens();
}

export function wsUrl(): string | null {
  if (!API_CONFIGURED) return null;
  return API_URL.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(getAccessToken() || "");
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
