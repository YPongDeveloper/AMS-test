// API client สำหรับระบบสั่งงาน — ตั้งค่า NEXT_PUBLIC_API_URL เพื่อเปิดใช้งาน
// Response envelope: { status, message, data } — api() คืน data เสมอ
// Token: JWT access (15 นาที) + refresh (30 วัน) — ต่ออายุอัตโนมัติเมื่อโดน 401

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
export const API_CONFIGURED = API_URL.length > 0;

export type Role = "admin" | "supervisor" | "subordinate";

export interface AppUser {
  public_id: string;
  username?: string | null;
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

// เข้าสู่ระบบด้วย username/password (บัญชีที่ admin จัดการ: admin/leader/normal)
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

