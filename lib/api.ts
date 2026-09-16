// API client สำหรับระบบสั่งงาน — ตั้งค่า NEXT_PUBLIC_API_URL เพื่อเปิดใช้งาน
// Response envelope: { status, message, data } — api() คืน data เสมอ
// Token: JWT access (15 นาที) + refresh (30 วัน) — ต่ออายุอัตโนมัติเมื่อโดน 401

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
export const API_CONFIGURED = API_URL.length > 0;

export type Role = "admin" | "supervisor" | "subordinate" | "accountant";

export interface AppUser {
  public_id: string;
  username?: string | null;
  display_name: string;
  picture_url: string | null;
  role: Role;
  status?: "active" | "resigned";
  created_at: string;
}

export type TaskStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "submitted"
  | "revision_requested"
  | "done"
  | "cancelled";

export type TaskType =
  | "survey_new"
  | "revision"
  | "batch_entry"
  | "survey"
  | "inspect"
  | "other";

export interface Task {
  public_id: string;
  code: string | null;
  title: string;
  task_type: TaskType;
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
  submission_data?: string | any | null;
  supervisor_feedback?: string | null;
  target_type?: "land" | "building" | "both" | null;
  created_at: string;
  updated_at: string;
}

export interface TaskSubmissionPayload {
  summary?: string;
  items?: any[];
  lands?: Partial<LandParcel>[];
  buildings?: Partial<Building>[];
  photos?: { id?: string; url: string; name: string; caption?: string; sizeKb?: number }[];
  polygon?: { lat: number; lng: number }[];
  area_sqm?: number;
  area_thai?: string;
  rai?: number;
  ngan?: number;
  wa?: number;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const ISSUED_KEY = "ams_token_issued";
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

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    // เผื่อเวลา 15 วินาทีก่อนหมดอายุจริง
    return Date.now() >= (payload.exp - 15) * 1000;
  } catch {
    return true;
  }
}

export function hasValidSession(): boolean {
  if (typeof window === "undefined") return false;
  const at = getAccessToken();
  const rt = getRefreshToken();
  const u = getCurrentUser();
  if (u) {
    if (!API_CONFIGURED) return true;
    if (at && !isTokenExpired(at)) return true;
    if (rt) return true;
    if (u.public_id?.startsWith("mock-")) return true;
    // หากมีข้อมูลผู้ใช้อยู่ในเครื่อง ให้ถือว่ายังมีเซสชัน (ป้องกันการเด้งหลุดโดยไม่จำเป็น)
    return true;
  }
  return false;
}

function saveTokens(access: string, refresh: string) {
  window.localStorage.setItem(ACCESS_KEY, access);
  window.localStorage.setItem(REFRESH_KEY, refresh);
  window.localStorage.setItem(ISSUED_KEY, String(Date.now()));
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(ISSUED_KEY);
  window.localStorage.removeItem(USER_KEY);
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
export async function refreshTokens(): Promise<boolean> {
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
      // เฉพาะกรณีเซิร์ฟเวอร์ตอบ 401 ชัดเจนว่า token หมดอายุ/ถูกเพิกถอนจริง จึงค่อยล้าง token
      if (res.status === 401) {
        clearTokens();
        return false;
      }
      if (!res.ok) {
        // หากเซิร์ฟเวอร์ตอบ 500/502/503/504 (เช่น Render หลับ / Cold start) ห้ามล้าง token เด็ดขาด
        return false;
      }
      const env = (await res.json()) as Envelope<{ token: TokenPair; user: AppUser }>;
      if (!env.data?.token) {
        return false;
      }
      saveTokens(env.data.token.access_token, env.data.token.refresh_token);
      if (env.data.user) saveCurrentUser(env.data.user);
      return true;
    } catch {
      // Network failure / Failed to fetch (เช่น เน็ตมือถือสะดุดหรือเซิร์ฟเวอร์กำลังตื่น) ห้ามล้าง token
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown; skipAuthCheck?: boolean }): Promise<T> {
  if (!API_CONFIGURED) throw new ApiError("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_API_URL", 0);

  const isAuthEndpoint = path.startsWith("/api/auth/login") || path.startsWith("/api/auth/refresh") || path === "/health";

  // Broken Access Control Guard: ทุก Action ต้องมี at หรือ rt ที่ยังไม่หมดอายุ
  if (!isAuthEndpoint && !init?.skipAuthCheck && typeof window !== "undefined") {
    const at = getAccessToken();
    const rt = getRefreshToken();
    const u = getCurrentUser();

    // ถ้าไม่มี at และ rt เลย และไม่มี user ในเครื่อง
    if (!at && !rt) {
      if (!u || !u.public_id?.startsWith("mock-")) {
        clearTokens();
        window.location.href = "/?reason=unauthenticated";
        throw new ApiError("กรุณาเข้าสู่ระบบก่อนทำรายการ", 401);
      }
    } else if (isTokenExpired(at) && rt) {
      // Proactive refresh ก่อนส่ง Action
      const ok = await refreshTokens();
      if (!ok) {
        // ถ้า refresh ไม่สำเร็จ (เช่น เน็ตช้า หรือเซิร์ฟเวอร์ตื่นช้า) แต่ยังมี rt อยู่
        // อย่าเพิ่งสั่ง clearTokens() และเตะผู้ใช้ออก ให้ยิง doFetch ดูก่อน
        if (!getRefreshToken()) {
          clearTokens();
          window.location.href = "/?reason=session_expired";
          throw new ApiError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
        }
      }
    }
  }

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
  if (res.status === 401) {
    clearTokens();
    if (typeof window !== "undefined" && !isAuthEndpoint) {
      window.location.href = "/?reason=session_expired";
    }
  }

  const env = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok) {
    throw new ApiError(env?.message || `HTTP ${res.status}`, res.status);
  }
  return env?.data as T;
}

// เข้าสู่ระบบด้วย username/password (บัญชีที่ admin จัดการ: admin/leader/normal/accountant)
export async function loginWithPassword(username: string, password: string): Promise<AppUser> {
  const data = await api<{ user: AppUser; token: TokenPair }>("/api/auth/login", {
    method: "POST",
    json: { username, password },
  });
  if (data?.token) saveTokens(data.token.access_token, data.token.refresh_token);
  saveCurrentUser(data.user);
  return data.user;
}

// ---- current user cache (ให้ Topbar อ่าน role โดยไม่ต้องยิง API ซ้ำ) ----

const USER_KEY = "ams_current_user";

export function saveCurrentUser(u: AppUser) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(u));
}

// เข้าสู่ระบบโหมดทดสอบ (Offline / Demo Fallback เมื่อเซิร์ฟเวอร์ยังไม่พร้อมหรือติด CORS)
export function loginDemo(role: Role = "supervisor"): AppUser {
  const mockUser: AppUser = {
    public_id:
      role === "admin"
        ? "u-admin"
        : role === "supervisor"
        ? "usr-leader"
        : role === "accountant"
        ? "u-acc"
        : "usr-normal",
    username:
      role === "admin"
        ? "admin"
        : role === "supervisor"
        ? "leader"
        : role === "accountant"
        ? "accountant"
        : "normal",
    display_name:
      role === "admin"
        ? "ผู้ดูแลระบบสูงสุด"
        : role === "supervisor"
        ? "หัวหน้างานสำรวจ"
        : role === "accountant"
        ? "พนักงานบัญชีและการเงิน"
        : "นายสมศักดิ์ สำรวจดี (เจ้าหน้าที่สำรวจ 1)",
    picture_url: null,
    role,
    status: "active",
    created_at: new Date().toISOString(),
  };
  saveCurrentUser(mockUser);
  return mockUser;
}

// ---- Admin User Management APIs ----

const USERS_CACHE_KEY = "ams_mock_users_list";

const DEFAULT_MOCK_USERS: AppUser[] = [
  { public_id: "u-admin", username: "admin", display_name: "ผู้ดูแลระบบสูงสุด", picture_url: null, role: "admin", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-leader", username: "leader", display_name: "หัวหน้างานสำรวจ", picture_url: null, role: "supervisor", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-normal", username: "normal", display_name: "นายสมศักดิ์ สำรวจดี (เจ้าหน้าที่สำรวจ 1)", picture_url: null, role: "subordinate", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-officer2", username: "officer2", display_name: "น.ส.วิภาดา รังวัดไว (เจ้าหน้าที่สำรวจ 2)", picture_url: null, role: "subordinate", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-officer3", username: "officer3", display_name: "นายธนกร ตรวจสอบการช่าง (เจ้าหน้าที่สำรวจ 3)", picture_url: null, role: "subordinate", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-officer4", username: "officer4", display_name: "นายปิยะพงษ์ ผังเมืองรังวัด (เจ้าหน้าที่สำรวจ 4)", picture_url: null, role: "subordinate", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-officer5", username: "officer5", display_name: "นายกิตติศักดิ์ ช่างสำรวจอิสระ (รอย้ายเข้าสังกัด)", picture_url: null, role: "subordinate", status: "active", created_at: new Date().toISOString() },
  { public_id: "u-acc", username: "accountant", display_name: "พนักงานบัญชีและการเงิน", picture_url: null, role: "accountant", status: "active", created_at: new Date().toISOString() },
];

function getLocalUsers(): AppUser[] {
  if (typeof window === "undefined") return DEFAULT_MOCK_USERS;
  try {
    const raw = window.localStorage.getItem(USERS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 7) return parsed;
    }
  } catch {}
  saveLocalUsers(DEFAULT_MOCK_USERS);
  return DEFAULT_MOCK_USERS;
}

function saveLocalUsers(us: AppUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(us));
}

export async function fetchUsers(role?: string): Promise<AppUser[]> {
  if (!API_CONFIGURED) {
    const all = getLocalUsers();
    return role ? all.filter((u) => u.role === role) : all;
  }
  try {
    return await api<AppUser[]>(role ? `/api/users?role=${encodeURIComponent(role)}` : "/api/users");
  } catch {
    const all = getLocalUsers();
    return role ? all.filter((u) => u.role === role) : all;
  }
}

export async function createUser(data: { username: string; password: string; display_name: string; role: Role }): Promise<AppUser> {
  if (!API_CONFIGURED) {
    const all = getLocalUsers();
    const newUser: AppUser = {
      public_id: "u-" + Date.now(),
      username: data.username,
      display_name: data.display_name,
      picture_url: null,
      role: data.role,
      status: "active",
      created_at: new Date().toISOString(),
    };
    all.unshift(newUser);
    saveLocalUsers(all);
    return newUser;
  }
  return api<AppUser>("/api/users", { method: "POST", json: data });
}

export async function updateUser(public_id: string, data: { display_name: string; role: Role; status: "active" | "resigned" }): Promise<void> {
  if (!API_CONFIGURED) {
    const all = getLocalUsers();
    const idx = all.findIndex((u) => u.public_id === public_id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...data };
      saveLocalUsers(all);
    }
    return;
  }
  await api(`/api/users/${encodeURIComponent(public_id)}`, { method: "PUT", json: data });
}

export async function resetUserPassword(public_id: string, password: string): Promise<void> {
  if (!API_CONFIGURED) return;
  await api(`/api/users/${encodeURIComponent(public_id)}/password`, { method: "POST", json: { password } });
}

export async function setUserStatus(public_id: string, status: "active" | "resigned"): Promise<void> {
  if (!API_CONFIGURED) {
    const all = getLocalUsers();
    const idx = all.findIndex((u) => u.public_id === public_id);
    if (idx >= 0) {
      all[idx].status = status;
      saveLocalUsers(all);
    }
    return;
  }
  await api(`/api/users/${encodeURIComponent(public_id)}/status`, { method: "PATCH", json: { status } });
}

export function getCurrentUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
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

// ensureFreshAccessToken — access token อายุ 15 นาที; ถ้าใกล้หมดอายุ (>=13 นาที) ให้ต่ออายุก่อน
// (ใช้ก่อนเชื่อม WebSocket เพื่อไม่ให้โดน 401 วนลูป)
export async function ensureFreshAccessToken(): Promise<void> {
  if (!API_CONFIGURED || !getRefreshToken()) return;
  const issued = Number(window.localStorage.getItem(ISSUED_KEY) || 0);
  const ageMin = (Date.now() - issued) / 60000;
  if (issued > 0 && ageMin < 13 && getAccessToken()) return;
  await refreshTokens();
}

// ---- labels ----

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "รอรับงาน",
  accepted: "รับงานแล้ว",
  in_progress: "กำลังปฏิบัติงาน",
  submitted: "ส่งมอบแล้ว (รอตรวจ)",
  revision_requested: "ส่งกลับให้แก้ไข",
  done: "อนุมัติแล้ว (เสร็จสิ้น)",
  cancelled: "ยกเลิก",
};

export const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-sky-100 text-sky-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  submitted: "bg-purple-100 text-purple-800",
  revision_requested: "bg-rose-100 text-rose-800",
  done: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export const TYPE_LABEL: Record<TaskType, string> = {
  survey_new: "สำรวจใหม่ (ชี้เป้า)",
  revision: "แก้ไขงาน",
  batch_entry: "ลงข้อมูลใหม่ (หลายรายการ)",
  survey: "งานเก็บข้อมูล",
  inspect: "งานตรวจสอบ",
  other: "งานอื่น ๆ",
};

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " น.";
  } catch {
    return "-";
  }
}

// ---- Land & Building Types and APIs ----

export interface LandParcel {
  public_id: string;
  land_code: string;
  srt_land_type: string;
  land_use: string;
  land_type: string;
  deed_no: string;
  dimension: string;
  rai?: number | null;
  ngan?: number | null;
  wa?: number | null;
  width: number | null;
  length: number | null;
  picture_f: string;
  lat?: number | null;
  lng?: number | null;
  address_no?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postal_code?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface FloorDetail {
  floor_number: number;
  bldg_use: string;
  dim: number | null;
  width: number | null;
  length: number | null;
}

export interface Building {
  public_id: string;
  bldg_code: string;
  land_code: string;
  name: string;
  bldg_69: string;
  material_type: string;
  age: string;
  be_age: string;
  num_fl: number;
  floors: FloorDetail[];
  bld_condition_type: string;
  picture_f: string;
  picture_b: string;
  picture_r: string;
  picture_l: string;
  address_no?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postal_code?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Mock fallback data for demo/offline
const MOCK_LANDS: LandParcel[] = [
  {
    public_id: "mock-lp-1",
    land_code: "LP-2569-0043",
    srt_land_type: "ที่ดินสถานี",
    land_use: "ใช้เพื่อการขนส่ง",
    land_type: "โฉนด",
    deed_no: "12345/2540",
    dimension: "2-1-50",
    rai: 2,
    ngan: 1,
    wa: 50,
    width: 45.5,
    length: 120.0,
    picture_f: "",
    lat: 13.7563,
    lng: 100.5018,
    address_no: "1 ถนนรองเมือง",
    subdistrict: "รองเมือง",
    district: "ปทุมวัน",
    province: "กรุงเทพมหานคร",
    postal_code: "10330",
    created_by: "เจ้าหน้าที่สำรวจ",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    public_id: "mock-lp-2",
    land_code: "LP-2569-0044",
    srt_land_type: "ที่ดินเชิงพาณิชย์",
    land_use: "ใช้เพื่อการพาณิชย์",
    land_type: "โฉนด",
    deed_no: "54321/2545",
    dimension: "1-0-20",
    rai: 1,
    ngan: 0,
    wa: 20,
    width: 30.0,
    length: 60.0,
    picture_f: "",
    lat: 13.765,
    lng: 100.52,
    address_no: "234/12 ถนนพหลโยธิน",
    subdistrict: "จตุจักร",
    district: "จตุจักร",
    province: "กรุงเทพมหานคร",
    postal_code: "10900",
    created_by: "เจ้าหน้าที่สำรวจ",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    public_id: "mock-lp-3",
    land_code: "LP-2569-0088",
    srt_land_type: "ที่ดินเกษตรกรรม",
    land_use: "ใช้เพื่อการเกษตร",
    land_type: "โฉนด",
    deed_no: "78910/2550",
    dimension: "5-2-80",
    rai: 5,
    ngan: 2,
    wa: 80,
    width: 100.0,
    length: 220.0,
    picture_f: "",
    lat: 14.706,
    lng: 101.416,
    address_no: "88 หมู่ 4 ถ.มิตรภาพ",
    subdistrict: "ปากช่อง",
    district: "ปากช่อง",
    province: "นครราชสีมา",
    postal_code: "30130",
    created_by: "เจ้าหน้าที่สำรวจ",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const MOCK_BUILDINGS: Building[] = [
  {
    public_id: "mock-bl-1",
    bldg_code: "BL-2569-0118",
    land_code: "LP-2569-0043",
    name: "อาคารสำนักงานใหญ่ ชั้น 1-3",
    bldg_69: "301 - อาคารสำนักงาน",
    material_type: "คอนกรีตเสริมเหล็ก",
    age: "28",
    be_age: "2541",
    num_fl: 3,
    floors: [
      { floor_number: 1, bldg_use: "โถงต้อนรับและสำนักงานบริการ", dim: 300, width: 15, length: 20 },
      { floor_number: 2, bldg_use: "สำนักงานปฏิบัติการฝ่ายเดินรถ", dim: 300, width: 15, length: 20 },
      { floor_number: 3, bldg_use: "ห้องประชุมและฝ่ายบริหาร", dim: 300, width: 15, length: 20 },
    ],
    bld_condition_type: "ดี",
    picture_f: "",
    picture_b: "",
    picture_r: "",
    picture_l: "",
    address_no: "1 อาคารสำนักงานบริหาร",
    subdistrict: "รองเมือง",
    district: "ปทุมวัน",
    province: "กรุงเทพมหานคร",
    postal_code: "10330",
    created_by: "เจ้าหน้าที่สำรวจ",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    public_id: "mock-bl-2",
    bldg_code: "BL-2569-0119",
    land_code: "LP-2569-0044",
    name: "ศูนย์การค้าคอมมูนิตี้มอลล์จตุจักร",
    bldg_69: "302 - อาคารพาณิชย์",
    material_type: "คอนกรีตเสริมเหล็ก",
    age: "12",
    be_age: "2557",
    num_fl: 2,
    floors: [
      { floor_number: 1, bldg_use: "ร้านค้าและพื้นที่บริการพาณิชย์", dim: 450, width: 20, length: 22.5 },
      { floor_number: 2, bldg_use: "ศูนย์อาหารและสำนักงานผู้จัดการ", dim: 450, width: 20, length: 22.5 },
    ],
    bld_condition_type: "ดีมาก",
    picture_f: "",
    picture_b: "",
    picture_r: "",
    picture_l: "",
    address_no: "234/12 อาคารเอ",
    subdistrict: "จตุจักร",
    district: "จตุจักร",
    province: "กรุงเทพมหานคร",
    postal_code: "10900",
    created_by: "เจ้าหน้าที่สำรวจ",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function fetchLands(q?: string): Promise<LandParcel[]> {
  if (!API_CONFIGURED) {
    if (!q) return MOCK_LANDS;
    return MOCK_LANDS.filter(
      (l) => l.land_code.includes(q) || l.deed_no.includes(q) || l.srt_land_type.includes(q),
    );
  }
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return api<LandParcel[]>(`/api/lands${query}`);
}

export async function getLand(publicId: string): Promise<LandParcel> {
  if (!API_CONFIGURED) {
    const found = MOCK_LANDS.find((l) => l.public_id === publicId);
    if (!found) throw new Error("ไม่พบข้อมูลแปลงที่ดิน");
    return found;
  }
  return api<LandParcel>(`/api/lands/${publicId}`);
}

export async function createLand(data: Partial<LandParcel>): Promise<LandParcel> {
  if (!API_CONFIGURED) {
    const newL: LandParcel = {
      public_id: "mock-" + Date.now(),
      land_code: data.land_code || "LP-NEW",
      srt_land_type: data.srt_land_type || "",
      land_use: data.land_use || "",
      land_type: data.land_type || "",
      deed_no: data.deed_no || "",
      dimension: data.dimension || "",
      rai: data.rai ?? 0,
      ngan: data.ngan ?? 0,
      wa: data.wa ?? 0,
      width: data.width || 0,
      length: data.length || 0,
      picture_f: data.picture_f || "",
      lat: data.lat || 13.7563,
      lng: data.lng || 100.5018,
      address_no: data.address_no || "",
      subdistrict: data.subdistrict || "",
      district: data.district || "",
      province: data.province || "",
      postal_code: data.postal_code || "",
      created_by: "ฉัน (Demo)",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    MOCK_LANDS.unshift(newL);
    return newL;
  }
  return api<LandParcel>("/api/lands", { method: "POST", json: data });
}

export async function updateLand(publicId: string, data: Partial<LandParcel>): Promise<LandParcel> {
  if (!API_CONFIGURED) {
    const idx = MOCK_LANDS.findIndex((l) => l.public_id === publicId);
    if (idx >= 0) {
      MOCK_LANDS[idx] = { ...MOCK_LANDS[idx], ...data, updated_at: new Date().toISOString() };
      return MOCK_LANDS[idx];
    }
    throw new Error("ไม่พบข้อมูลแปลงที่ดิน");
  }
  return api<LandParcel>(`/api/lands/${publicId}`, { method: "PUT", json: data });
}

export async function deleteLand(publicId: string): Promise<void> {
  if (!API_CONFIGURED) {
    const idx = MOCK_LANDS.findIndex((l) => l.public_id === publicId);
    if (idx >= 0) MOCK_LANDS.splice(idx, 1);
    return;
  }
  await api(`/api/lands/${publicId}`, { method: "DELETE" });
}

export async function fetchBuildings(q?: string, landCode?: string): Promise<Building[]> {
  if (!API_CONFIGURED) {
    let res = MOCK_BUILDINGS;
    if (landCode) res = res.filter((b) => b.land_code === landCode);
    if (q) res = res.filter((b) => b.bldg_code.includes(q) || b.name.includes(q));
    return res;
  }
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (landCode) params.set("land_code", landCode);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return api<Building[]>(`/api/buildings${qs}`);
}

export async function getBuilding(publicId: string): Promise<Building> {
  if (!API_CONFIGURED) {
    const found = MOCK_BUILDINGS.find((b) => b.public_id === publicId);
    if (!found) throw new Error("ไม่พบข้อมูลสิ่งปลูกสร้าง");
    return found;
  }
  return api<Building>(`/api/buildings/${publicId}`);
}

export async function createBuilding(data: Partial<Building>): Promise<Building> {
  if (!API_CONFIGURED) {
    const newB: Building = {
      public_id: "mock-bl-" + Date.now(),
      bldg_code: data.bldg_code || "BL-NEW",
      land_code: data.land_code || "",
      name: data.name || "",
      bldg_69: data.bldg_69 || "",
      material_type: data.material_type || "",
      age: data.age || "",
      be_age: data.be_age || "",
      num_fl: data.num_fl || 1,
      floors: data.floors || [],
      bld_condition_type: data.bld_condition_type || "",
      picture_f: data.picture_f || "",
      picture_b: data.picture_b || "",
      picture_r: data.picture_r || "",
      picture_l: data.picture_l || "",
      address_no: data.address_no || "",
      subdistrict: data.subdistrict || "",
      district: data.district || "",
      province: data.province || "",
      postal_code: data.postal_code || "",
      created_by: "ฉัน (Demo)",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    MOCK_BUILDINGS.unshift(newB);
    return newB;
  }
  return api<Building>("/api/buildings", { method: "POST", json: data });
}

export async function updateBuilding(publicId: string, data: Partial<Building>): Promise<Building> {
  if (!API_CONFIGURED) {
    const idx = MOCK_BUILDINGS.findIndex((b) => b.public_id === publicId);
    if (idx >= 0) {
      MOCK_BUILDINGS[idx] = { ...MOCK_BUILDINGS[idx], ...data, updated_at: new Date().toISOString() };
      return MOCK_BUILDINGS[idx];
    }
    throw new Error("ไม่พบข้อมูลสิ่งปลูกสร้าง");
  }
  return api<Building>(`/api/buildings/${publicId}`, { method: "PUT", json: data });
}

export async function deleteBuilding(publicId: string): Promise<void> {
  if (!API_CONFIGURED) {
    const idx = MOCK_BUILDINGS.findIndex((b) => b.public_id === publicId);
    if (idx >= 0) MOCK_BUILDINGS.splice(idx, 1);
    return;
  }
  await api(`/api/buildings/${publicId}`, { method: "DELETE" });
}

// ---- Team Management Types & APIs ----

export interface TeamMember {
  id?: number;
  supervisor_public_id: string;
  supervisor_name: string;
  supervisor_username?: string;
  subordinate_public_id: string;
  subordinate_name: string;
  subordinate_username: string;
  status: "pending" | "accepted" | "declined";
  invited_at: string;
  responded_at?: string | null;
}

export function notifyDataUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ams_data_updated"));
  }
}

const TEAM_STORAGE_KEY = "ams_mock_team_members";

const DEFAULT_MOCK_TEAM: TeamMember[] = [
  {
    supervisor_public_id: "usr-leader",
    supervisor_name: "หัวหน้างานสำรวจ",
    supervisor_username: "leader",
    subordinate_public_id: "usr-normal",
    subordinate_name: "นายสมศักดิ์ สำรวจดี (เจ้าหน้าที่สำรวจ 1)",
    subordinate_username: "normal",
    status: "accepted",
    invited_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    responded_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    supervisor_public_id: "usr-leader",
    supervisor_name: "หัวหน้างานสำรวจ",
    supervisor_username: "leader",
    subordinate_public_id: "usr-officer2",
    subordinate_name: "น.ส.วิภาดา รังวัดไว (เจ้าหน้าที่สำรวจ 2)",
    subordinate_username: "officer2",
    status: "accepted",
    invited_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    responded_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    supervisor_public_id: "usr-leader",
    supervisor_name: "หัวหน้างานสำรวจ",
    supervisor_username: "leader",
    subordinate_public_id: "usr-officer3",
    subordinate_name: "นายธนกร ตรวจสอบการช่าง (เจ้าหน้าที่สำรวจ 3)",
    subordinate_username: "officer3",
    status: "accepted",
    invited_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    responded_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    supervisor_public_id: "usr-leader",
    supervisor_name: "หัวหน้างานสำรวจ",
    supervisor_username: "leader",
    subordinate_public_id: "usr-officer4",
    subordinate_name: "นายปิยะพงษ์ ผังเมืองรังวัด (เจ้าหน้าที่สำรวจ 4)",
    subordinate_username: "officer4",
    status: "accepted",
    invited_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    responded_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

function getLocalTeam(): TeamMember[] {
  if (typeof window === "undefined") return DEFAULT_MOCK_TEAM;
  try {
    const raw = window.localStorage.getItem(TEAM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 4) {
        return parsed.filter((m) => m && typeof m === "object");
      }
    }
  } catch {}
  saveLocalTeam(DEFAULT_MOCK_TEAM);
  return DEFAULT_MOCK_TEAM;
}

function saveLocalTeam(list: TeamMember[]) {
  if (typeof window === "undefined") return;
  const safe = Array.isArray(list) ? list : [];
  window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(safe));
}

export async function inviteToTeam(username: string): Promise<void> {
  if (!API_CONFIGURED) {
    const local = getLocalTeam();
    const all = Array.isArray(local) ? [...local] : [];
    const cur = getCurrentUser();
    const existing = all.find((m) => m && m.subordinate_username === username);
    if (existing) {
      existing.status = "pending";
      existing.invited_at = new Date().toISOString();
    } else {
      all.unshift({
        supervisor_public_id: cur?.public_id || "mock-leader",
        supervisor_name: cur?.display_name || "หัวหน้างานสำรวจ",
        subordinate_public_id: "mock-" + username,
        subordinate_name: username === "normal" ? "เจ้าหน้าที่สำรวจ (Demo)" : username,
        subordinate_username: username,
        status: "pending",
        invited_at: new Date().toISOString(),
      });
    }
    saveLocalTeam(all);
    notifyDataUpdated();
    return;
  }
  await api("/api/team/invite", { method: "POST", json: { username } });
  notifyDataUpdated();
}

export async function fetchMyTeam(): Promise<TeamMember[]> {
  if (!API_CONFIGURED) {
    const local = getLocalTeam();
    return Array.isArray(local) ? local : [];
  }
  try {
    const res = await api<TeamMember[]>("/api/team/members");
    return Array.isArray(res) ? res : [];
  } catch {
    const local = getLocalTeam();
    return Array.isArray(local) ? local : [];
  }
}

export async function fetchMyInvitations(): Promise<TeamMember[]> {
  if (!API_CONFIGURED) {
    const cur = getCurrentUser();
    const local = getLocalTeam();
    const arr = Array.isArray(local) ? local : [];
    return arr.filter(
      (m) =>
        m &&
        m.status === "pending" &&
        (
          !cur ||
          cur.role === "subordinate" ||
          (m.subordinate_username && cur.username && m.subordinate_username.toLowerCase() === cur.username.toLowerCase()) ||
          (m.subordinate_public_id && cur.public_id && m.subordinate_public_id === cur.public_id)
        )
    );
  }
  try {
    const res = await api<TeamMember[]>("/api/team/invitations");
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function respondToInvitation(supervisorPublicId: string, action: "accepted" | "declined"): Promise<void> {
  if (!API_CONFIGURED) {
    const local = getLocalTeam();
    const all = Array.isArray(local) ? [...local] : [];
    const cur = getCurrentUser();
    const item = all.find(
      (m) =>
        m &&
        (m.supervisor_public_id === supervisorPublicId || !supervisorPublicId) &&
        (
          !cur ||
          cur.role === "subordinate" ||
          (m.subordinate_username && cur.username && m.subordinate_username.toLowerCase() === cur.username.toLowerCase()) ||
          (m.subordinate_public_id && cur.public_id && m.subordinate_public_id === cur.public_id)
        )
    );
    if (item) {
      item.status = action;
      item.responded_at = new Date().toISOString();
      saveLocalTeam(all);
    }
    notifyDataUpdated();
    return;
  }
  await api("/api/team/respond", {
    method: "POST",
    json: { supervisor_public_id: supervisorPublicId, action },
  });
  notifyDataUpdated();
}

export async function removeTeamMember(subordinatePublicId: string): Promise<void> {
  if (!API_CONFIGURED) {
    const local = getLocalTeam();
    const all = (Array.isArray(local) ? local : []).filter((m) => m && m.subordinate_public_id !== subordinatePublicId);
    saveLocalTeam(all);
    notifyDataUpdated();
    return;
  }
  await api(`/api/team/${subordinatePublicId}`, { method: "DELETE" });
  notifyDataUpdated();
}

// ---- Accountant Revision Requests Types & APIs ----

export interface RevisionRequest {
  id?: string;
  public_id: string;
  requester_public_id: string;
  requester_name?: string;
  creator_name?: string;
  target_type: "land" | "building" | "general";
  target_id?: string | null;
  target_code?: string | null;
  request_type?: "revision" | "survey_new";
  remark?: string;
  remarks?: string;
  status: "pending" | "assigned" | "resolved";
  assigned_task_public_id?: string | null;
  created_at: string;
  updated_at: string;
}

const REQUESTS_STORAGE_KEY = "ams_mock_revision_requests";

function getLocalRequests(): RevisionRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REQUESTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((r) => r && typeof r === "object");
    }
  } catch {}
  return [
    {
      id: "req-01",
      public_id: "req-01",
      requester_public_id: "mock-accountant",
      requester_name: "พนักงานบัญชีและการเงิน (Demo)",
      creator_name: "พนักงานบัญชีและการเงิน (Demo)",
      target_type: "land",
      target_code: "LP-2569-0042",
      request_type: "revision",
      remark: "ตรวจสอบขนาดพื้นที่ดินและอัตราภาษีเพิ่มเติม พบความคลาดเคลื่อนในการคำนวณภาษีปี 2569",
      remarks: "ตรวจสอบขนาดพื้นที่ดินและอัตราภาษีเพิ่มเติม พบความคลาดเคลื่อนในการคำนวณภาษีปี 2569",
      status: "pending",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ];
}

function saveLocalRequests(list: RevisionRequest[]) {
  if (typeof window === "undefined") return;
  const safe = Array.isArray(list) ? list : [];
  window.localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(safe));
}

export async function createRevisionRequest(data: {
  target_type: "land" | "building" | "general";
  target_id?: string;
  target_code?: string;
  request_type?: "revision" | "survey_new";
  remark?: string;
  remarks?: string;
}): Promise<RevisionRequest> {
  const remarkText = data.remarks || data.remark || "";
  if (!API_CONFIGURED) {
    const cur = getCurrentUser();
    const local = getLocalRequests();
    const all = Array.isArray(local) ? [...local] : [];
    const newReq: RevisionRequest = {
      id: "req-" + Date.now(),
      public_id: "req-" + Date.now(),
      requester_public_id: cur?.public_id || "mock-accountant",
      requester_name: cur?.display_name || "พนักงานบัญชี",
      creator_name: cur?.display_name || "พนักงานบัญชี",
      target_type: data.target_type,
      target_id: data.target_id || null,
      target_code: data.target_code || null,
      request_type: data.request_type || "revision",
      remark: remarkText,
      remarks: remarkText,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    all.unshift(newReq);
    saveLocalRequests(all);
    notifyDataUpdated();
    return newReq;
  }
  const created = await api<RevisionRequest>("/api/requests", {
    method: "POST",
    json: {
      target_type: data.target_type,
      target_id: data.target_id,
      target_code: data.target_code,
      request_type: data.request_type || "revision",
      remarks: remarkText,
      remark: remarkText,
    },
  });
  notifyDataUpdated();
  return created;
}

export async function fetchRevisionRequests(status?: string): Promise<RevisionRequest[]> {
  if (!API_CONFIGURED) {
    const local = getLocalRequests();
    const all = Array.isArray(local) ? local : [];
    return status ? all.filter((r) => r && r.status === status) : all;
  }
  try {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await api<RevisionRequest[]>(`/api/requests${q}`);
    const all = Array.isArray(res) ? res : [];
    return status ? all.filter((r) => r && r.status === status) : all;
  } catch {
    const local = getLocalRequests();
    const all = Array.isArray(local) ? local : [];
    return status ? all.filter((r) => r && r.status === status) : all;
  }
}

export async function assignRevisionRequest(requestPublicId: string, taskPublicId: string): Promise<void> {
  if (!API_CONFIGURED) {
    const all = getLocalRequests();
    const it = all.find((r) => r.public_id === requestPublicId);
    if (it) {
      it.status = "assigned";
      it.assigned_task_public_id = taskPublicId;
      saveLocalRequests(all);
    }
    notifyDataUpdated();
    return;
  }
  await api(`/api/requests/${requestPublicId}/assign`, {
    method: "POST",
    json: { task_public_id: taskPublicId },
  });
  notifyDataUpdated();
}

// ---- Task Data Submit & Review APIs ----

const TASK_STORAGE_KEY = "ams_saved_tasks_v6";

export async function submitTaskData(
  taskPublicId: string,
  data: TaskSubmissionPayload
): Promise<Task> {
  if (!API_CONFIGURED) {
    // Local mock update
    const saved = typeof window !== "undefined" ? (window.localStorage.getItem(TASK_STORAGE_KEY) || window.localStorage.getItem("ams_saved_tasks_v5")) : null;
    let list: Task[] = saved ? JSON.parse(saved) : [];
    const idx = list.findIndex((t) => t.public_id === taskPublicId);
    if (idx >= 0) {
      list[idx].status = "submitted";
      list[idx].submission_data = data;
      list[idx].updated_at = new Date().toISOString();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(list));
      }
      notifyDataUpdated();
      return list[idx];
    }
    throw new Error("ไม่พบงาน");
  }
  const res = await api<Task>(`/api/tasks/${taskPublicId}/submit`, {
    method: "POST",
    json: { data },
  });
  notifyDataUpdated();
  return res;
}

export async function reviewTask(
  taskPublicId: string,
  action: "approve" | "reject",
  feedback?: string
): Promise<Task> {
  if (!API_CONFIGURED) {
    const saved = typeof window !== "undefined" ? (window.localStorage.getItem(TASK_STORAGE_KEY) || window.localStorage.getItem("ams_saved_tasks_v5")) : null;
    let list: Task[] = saved ? JSON.parse(saved) : [];
    const idx = list.findIndex((t) => t.public_id === taskPublicId);
    if (idx >= 0) {
      const task = list[idx];
      if (action === "approve") {
        task.status = "done";
        // Commit lands and buildings to mock
        if (task.submission_data) {
          try {
            const parsed = typeof task.submission_data === "string" ? JSON.parse(task.submission_data) : task.submission_data;
            if (Array.isArray(parsed.lands)) {
              for (const l of parsed.lands) {
                if (l.land_code) createLand(l);
              }
            }
            if (Array.isArray(parsed.buildings)) {
              for (const b of parsed.buildings) {
                if (b.bldg_code) createBuilding(b);
              }
            }
            if (Array.isArray(parsed.items)) {
              if (task.target_type === "building") {
                for (const b of parsed.items) if (b.bldg_code) createBuilding(b);
              } else {
                for (const l of parsed.items) if (l.land_code) createLand(l);
              }
            }
          } catch {}
        }
      } else {
        task.status = "revision_requested";
        task.supervisor_feedback = feedback || null;
      }
      task.updated_at = new Date().toISOString();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(list));
      }
      notifyDataUpdated();
      return task;
    }
    throw new Error("ไม่พบงาน");
  }
  const res = await api<Task>(`/api/tasks/${taskPublicId}/review`, {
    method: "POST",
    json: { action, feedback },
  });
  notifyDataUpdated();
  return res;
}

export async function fetchTasksList(): Promise<Task[]> {
  if (API_CONFIGURED) {
    try {
      const res = await api<Task[]>("/api/tasks");
      if (Array.isArray(res) && res.length > 0) return res;
    } catch {}
  }
  if (typeof window !== "undefined") {
    const cached = window.localStorage.getItem(TASK_STORAGE_KEY) || window.localStorage.getItem("ams_saved_tasks_v5");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.filter((t) => t && typeof t === "object" && t.public_id);
        }
      } catch {}
    }
  }
  return [];
}

