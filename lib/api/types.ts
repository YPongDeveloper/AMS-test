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
  address?: string | null;
  submission_data?: string | any | null;
  supervisor_feedback?: string | null;
  target_type?: "land" | "building" | "both" | null;
  created_at: string;
  updated_at: string;
}

export interface TaskSubmissionPayload {
  summary?: string;
  address?: string;
  place_name?: string;
  lat?: number | null;
  lng?: number | null;
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

export interface RevisionRequest {
  id?: string;
  public_id: string;
  requester_public_id?: string;
  requester_name?: string;
  creator_name?: string;
  target_type: "land" | "building" | "general";
  target_id?: string | null;
  target_code?: string | null;
  request_type?: "revision" | "survey_new";
  remark?: string;
  remarks?: string;
  status: "pending" | "assigned" | "resolved";
  assigned_task_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardData {
  totalLands: number;
  totalBuildings: number;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  totalTaxBase: number;
  estimatedTax: number;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

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

export interface Envelope<T> {
  status: number;
  message: string;
  data: T | null;
}
