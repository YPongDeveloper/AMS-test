import { AppUser, LandParcel, Building, TeamMember, RevisionRequest, Task } from "./types";

export const USERS_CACHE_KEY = "ams_mock_users_list";
export const LANDS_STORAGE_KEY = "ams_mock_lands_v3";
export const BUILDINGS_STORAGE_KEY = "ams_mock_buildings_v3";
export const TEAM_STORAGE_KEY = "ams_mock_team_members_v3";
export const REQUESTS_STORAGE_KEY = "ams_mock_requests_v3";
export const TASK_STORAGE_KEY = "ams_saved_tasks_v6";

export const DEFAULT_MOCK_USERS: AppUser[] = [
  { public_id: "u-admin", username: "admin", display_name: "ผู้ดูแลระบบสูงสุด", picture_url: null, role: "admin", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-leader", username: "leader", display_name: "หัวหน้างานสำรวจ", picture_url: null, role: "supervisor", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-normal", username: "normal", display_name: "นายสมศักดิ์ สำรวจดี (เจ้าหน้าที่สำรวจ 1)", picture_url: null, role: "subordinate", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-officer2", username: "officer2", display_name: "น.ส.วิภาดา รังวัดไว (เจ้าหน้าที่สำรวจ 2)", picture_url: null, role: "subordinate", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-officer3", username: "officer3", display_name: "นายธนกร ตรวจสอบการช่าง (เจ้าหน้าที่สำรวจ 3)", picture_url: null, role: "subordinate", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-officer4", username: "officer4", display_name: "นายปิยะพงษ์ ผังเมืองรังวัด (เจ้าหน้าที่สำรวจ 4)", picture_url: null, role: "subordinate", status: "active", created_at: new Date().toISOString() },
  { public_id: "usr-officer5", username: "officer5", display_name: "นายกิตติศักดิ์ ช่างสำรวจอิสระ (รอย้ายเข้าสังกัด)", picture_url: null, role: "subordinate", status: "active", created_at: new Date().toISOString() },
  { public_id: "u-acc", username: "accountant", display_name: "พนักงานบัญชีและการเงิน", picture_url: null, role: "accountant", status: "active", created_at: new Date().toISOString() },
];

export const MOCK_LANDS: LandParcel[] = [
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

export const MOCK_BUILDINGS: Building[] = [
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

export const DEFAULT_MOCK_TEAM: TeamMember[] = [
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

export function getLocalUsers(): AppUser[] {
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

export function saveLocalUsers(us: AppUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(us));
}

export function getLocalLands(): LandParcel[] {
  if (typeof window === "undefined") return MOCK_LANDS;
  try {
    const raw = window.localStorage.getItem(LANDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return MOCK_LANDS;
}

export function saveLocalLands(list: LandParcel[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANDS_STORAGE_KEY, JSON.stringify(list));
}

export function getLocalBuildings(): Building[] {
  if (typeof window === "undefined") return MOCK_BUILDINGS;
  try {
    const raw = window.localStorage.getItem(BUILDINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return MOCK_BUILDINGS;
}

export function saveLocalBuildings(list: Building[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BUILDINGS_STORAGE_KEY, JSON.stringify(list));
}

export function getLocalTeam(): TeamMember[] {
  if (typeof window === "undefined") return DEFAULT_MOCK_TEAM;
  try {
    const raw = window.localStorage.getItem(TEAM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 4) {
        return parsed.map((m) => {
          if (["normal", "officer2", "officer3", "officer4"].includes(m.subordinate_username)) {
            return { ...m, status: "accepted" as const };
          }
          return m;
        });
      }
    }
  } catch {}
  saveLocalTeam(DEFAULT_MOCK_TEAM);
  return DEFAULT_MOCK_TEAM;
}

export function saveLocalTeam(list: TeamMember[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(list));
}

export function getLocalRequests(): RevisionRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REQUESTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [
    {
      id: "req-demo-1",
      public_id: "req-demo-1",
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

export function saveLocalRequests(list: RevisionRequest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(list));
}
