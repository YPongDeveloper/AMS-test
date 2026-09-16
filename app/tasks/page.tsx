"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  api,
  API_CONFIGURED,
  fmtDateTime,
  STATUS_COLOR,
  STATUS_LABEL,
  TYPE_LABEL,
  type AppUser,
  type Task,
  type TaskStatus,
  type TeamMember,
  type RevisionRequest,
  inviteToTeam,
  fetchMyTeam,
  fetchMyInvitations,
  respondToInvitation,
  removeTeamMember,
  fetchRevisionRequests,
  submitTaskData,
  reviewTask,
} from "@/lib/api";
import { connectTaskWS } from "@/lib/ws";
import { useMe } from "@/lib/useMe";
import { Page } from "@/components/Page";
import MapPicker from "@/components/MapPicker";
import SurveyPolygonMap, { type LatLngPoint, type ThaiAreaResult } from "@/components/SurveyPolygonMap";
import TasksMasterMap from "@/components/TasksMasterMap";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  ClipboardList,
  MapPin,
  Plus,
  Radio,
  Users,
  CheckCircle2,
  Clock,
  PlayCircle,
  Check,
  AlertCircle,
  ExternalLink,
  Calendar,
  Layers,
  Filter,
  X,
  ChevronDown,
  ArrowRight,
  Activity,
  ChevronLeft,
  ChevronRight,
  Map,
  List,
  Navigation,
  Navigation2,
  RotateCcw,
  Search,
  Lock,
  FileCheck2,
  Award,
  Briefcase,
  History,
  UserMinus,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  Compass,
  ZoomIn,
  Info,
} from "lucide-react";

// 5 ขั้นตอนหลักของ Workflow ภารกิจสำรวจและส่งมอบงาน (ออกแบบตาม Delivery Tracker Pipeline)
const PIPELINE_STEPS = [
  { status: "pending" as TaskStatus, label: "รอรับงาน", sub: "มอบหมายแล้ว", icon: ClipboardList },
  { status: "accepted" as TaskStatus, label: "รับงานแล้ว", sub: "ยืนยันการรับ", icon: CheckCircle2 },
  { status: "in_progress" as TaskStatus, label: "กำลังปฏิบัติงาน", sub: "ลงพื้นที่สำรวจ", icon: MapPin },
  { status: "submitted" as TaskStatus, label: "ส่งตรวจแล้ว", sub: "รอหัวหน้าอนุมัติ", icon: FileCheck2 },
  { status: "done" as TaskStatus, label: "เสร็จสิ้น", sub: "อนุมัติเข้าระบบแล้ว", icon: Award },
];

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function getShiftedDate(baseDateStr: string, daysOffset: number): string {
  try {
    const parts = baseDateStr.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + daysOffset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

const getTaskDateStr = (task?: Task | null) => {
  if (!task) return "";
  const dt = task.due_at || task.created_at;
  if (!dt) return "";
  const plainMatch = String(dt).trim().match(/^(\d{4}-\d{2}-\d{2})$/);
  if (plainMatch) return plainMatch[1];
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
};

const getTaskCreatedDateStr = (task?: Task | null) => {
  if (!task?.created_at) return "";
  const plainMatch = String(task.created_at).trim().match(/^(\d{4}-\d{2}-\d{2})$/);
  if (plainMatch) return plainMatch[1];
  try {
    const d = new Date(task.created_at);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
};

function formatThaiDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10) + 543;
  const monthNames = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  const month = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
  const day = parseInt(parts[2], 10);
  return `${day} ${month} ${year}`;
}

function createSampleTasks(baseDateStr?: string): Task[] {
  const today = baseDateStr || getTodayStr();
  const yesterday = getShiftedDate(today, -1);
  const tomorrow = getShiftedDate(today, 1);

  return [
    // === งานสำหรับวันนี้ (TODAY) ครบทุกสถานะ ===
    {
      public_id: "tk-mock-01",
      code: "TK-2569-001",
      title: "สำรวจรังวัดแนวเขตแปลงที่ดิน ย่านสถานีรถไฟอยุธยา",
      task_type: "survey",
      description:
        "ตรวจสอบแนวเขตกรรมสิทธิ์ที่ดิน และบันทึกพิกัด GPS พร้อมขนาด ไร่-งาน-ตารางวา เพื่อนำข้อมูลเข้าสู่ระบบจัดการคำนวนภาษี ตามมาตรฐานปี 2569 พร้อมทั้งตรวจสอบหลักหมุดคอนกรีตว่ามีสภาพสมบูรณ์หรือไม่",
      status: "in_progress",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${today}T16:30:00`,
      lat: 14.3532,
      lng: 100.5828,
      place_name: "สถานีอยุธยา (ย่านคลังสินค้า)",
      created_at: `${today}T08:30:00`,
      updated_at: `${today}T09:15:00`,
    },
    {
      public_id: "tk-mock-02",
      code: "TK-2569-002",
      title: "ตรวจสอบสภาพอาคารสิ่งปลูกสร้าง ย่านกลางบางซื่อ",
      task_type: "inspect",
      description:
        "ถ่ายรูป 4 ทิศ และตรวจนับจำนวนชั้น ขนาดพื้นที่ เพื่อบันทึกเข้าสู่ระบบจัดการคำนวนภาษี รวมถึงประเมินสภาพความมั่นคงแข็งแรงของตัวโครงสร้าง และตรวจสอบการขอใช้พื้นที่ของผู้เช่า",
      status: "pending",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${today}T14:00:00`,
      lat: 13.8045,
      lng: 100.5398,
      place_name: "สถานีกลางกรุงเทพอภิวัฒน์ / ย่านพหลโยธิน",
      created_at: `${today}T08:00:00`,
      updated_at: `${today}T08:00:00`,
    },
    {
      public_id: "tk-mock-03",
      code: "TK-2569-003",
      title: "สำรวจพื้นที่เชิงพาณิชย์ให้เช่า สถานีรถไฟดอนเมือง",
      task_type: "survey",
      description:
        "ตรวจสอบสัญญาเช่าและพื้นที่ใช้สอยจริงของร้านค้าและอาคารพาณิชย์บริเวณแนวเขตสถานีรถไฟดอนเมือง เพื่อป้องกันการรุกล้ำพื้นที่นอกสัญญาเช่า",
      status: "pending",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${today}T11:30:00`,
      lat: 13.913,
      lng: 100.598,
      place_name: "สถานีรถไฟดอนเมือง (แนวเชื่อมต่อสนามบิน)",
      created_at: `${today}T08:15:00`,
      updated_at: `${today}T08:15:00`,
    },
    {
      public_id: "tk-mock-04",
      code: "TK-2569-004",
      title: "รังวัดหมุดหลักเขตแนวทางรถไฟ โรงงานมักกะสัน แปลง A",
      task_type: "survey",
      description:
        "ตรวจสภาพหลักหมุดคอนกรีตและรังวัดพิกัดดาวเทียม GNSS แปลงที่ดินโรงงานมักกะสัน เพื่อเตรียมส่งมอบพื้นที่พัฒนาเชิงพาณิชย์",
      status: "accepted",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${today}T13:00:00`,
      lat: 13.7505,
      lng: 100.5515,
      place_name: "โรงงานรถไฟมักกะสัน แปลง A",
      created_at: `${today}T08:45:00`,
      updated_at: `${today}T09:30:00`,
    },
    {
      public_id: "tk-mock-05",
      code: "TK-2569-005",
      title: "ตรวจสอบอาคารสถานีรถไฟประวัติศาสตร์ หัวลำโพง",
      task_type: "inspect",
      target_type: "building",
      description:
        "ตรวจสอบการอนุรักษ์อาคารสถาปัตยกรรมประวัติศาสตร์ และสำรวจพื้นที่เช่าบริการเชิงพาณิชย์ภายในโถงสถานีรถไฟกรุงเทพ",
      status: "submitted",
      submission_data: {
        summary: "ส่งผลสำรวจและตรวจสอบสภาพอาคารสถานีรถไฟประวัติศาสตร์หัวลำโพง พร้อมภาพถ่าย 4 ทิศ และรายละเอียดพื้นที่เช่า",
        items: [
          {
            bldg_code: "BL-2569-088",
            name: "อาคารสถานีรถไฟกรุงเทพ (หัวลำโพง)",
            material_type: "คอนกรีตเสริมเหล็ก",
            num_fl: 2,
            bld_condition_type: "ดี",
            address_no: "1 ถ.รองเมือง",
            subdistrict: "รองเมือง",
            district: "ปทุมวัน",
            province: "กรุงเทพมหานคร",
            postal_code: "10330",
          },
        ],
      },
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${today}T15:00:00`,
      lat: 13.738,
      lng: 100.5165,
      place_name: "สถานีรถไฟกรุงเทพ (หัวลำโพง)",
      created_at: `${today}T09:00:00`,
      updated_at: `${today}T10:00:00`,
    },
    {
      public_id: "tk-mock-06",
      code: "TK-2569-006",
      title: "สำรวจแนวเขตทางรถไฟสายแม่กลอง ย่านวงเวียนใหญ่",
      task_type: "survey",
      description:
        "รังวัดแนวรั้วและเขตทางรถไฟสายแม่กลอง ตรวจสอบระยะร่นความปลอดภัยจากทางรถไฟและสิ่งปลูกสร้างชั่วคราว",
      status: "pending",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${today}T17:00:00`,
      lat: 13.7225,
      lng: 100.4905,
      place_name: "สถานีรถไฟวงเวียนใหญ่ (สายแม่กลอง)",
      created_at: `${today}T09:20:00`,
      updated_at: `${today}T09:20:00`,
    },
    {
      public_id: "tk-mock-07",
      code: "TK-2569-007",
      title: "ตรวจสอบสัญญาเช่าที่ดินแปลงย่อย ย่านตลาดพลู",
      task_type: "inspect",
      description:
        "ตรวจวัดขนาดพื้นที่เช่าแผงค้าและร้านอาหารริมทาง เปรียบเทียบกับแบบแปลนสัญญาเช่า บันทึกผลตรวจเรียบร้อย",
      status: "done",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${today}T10:00:00`,
      lat: 13.7198,
      lng: 100.4789,
      place_name: "สถานีรถไฟตลาดพลู (ริมทางรถไฟ)",
      created_at: `${today}T07:30:00`,
      updated_at: `${today}T10:15:00`,
    },
    {
      public_id: "tk-mock-08",
      code: "TK-2569-008",
      title: "สำรวจแปลงที่ดินว่างเปล่า ย่านคลองเตยริมแม่น้ำเจ้าพระยา",
      task_type: "survey",
      description:
        "สำรวจรังวัดแนวเขตแปลงที่ดินริมแม่น้ำเจ้าพระยา และตรวจสอบระดับความลาดชันของตลิ่งเพื่อจัดทำแผนผังแม่บทพัฒนาทรัพย์สิน",
      status: "pending",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${today}T18:00:00`,
      lat: 13.7085,
      lng: 100.582,
      place_name: "คลังสินค้าริมแม่น้ำเจ้าพระยา คลองเตย",
      created_at: `${today}T09:40:00`,
      updated_at: `${today}T09:40:00`,
    },
    {
      public_id: "tk-mock-09",
      code: "TK-2569-009",
      title: "รังวัดแนวเขตที่ดินสถานีรถไฟธนบุรี (ศิริราช)",
      task_type: "survey",
      description:
        "สำรวจรังวัดแนวเขตที่ดินติดริมคลองบางกอกน้อย ตรวจสอบหลักเขตและแนวเขื่อนกันดิน พร้อมบันทึกภาพถ่ายสภาพพื้นที่",
      status: "in_progress",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${today}T16:00:00`,
      lat: 13.7588,
      lng: 100.4855,
      place_name: "สถานีรถไฟธนบุรีเดิม (ริมคลองบางกอกน้อย)",
      created_at: `${today}T08:50:00`,
      updated_at: `${today}T09:10:00`,
    },
    {
      public_id: "tk-mock-10",
      code: "TK-2569-010",
      title: "สำรวจจุดตัดทางรถไฟและอาคารควบคุม ยมราช",
      task_type: "survey",
      description:
        "งานสำรวจชะลอและยกเลิกชั่วคราวเนื่องจากมีการปรับปรุงแผนระบบระบายน้ำร่วมกับกรุงเทพมหานคร",
      status: "cancelled",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${today}T12:00:00`,
      lat: 13.757,
      lng: 100.521,
      place_name: "จุดตัดทางรถไฟยมราช ถนนเพชรบุรี",
      created_at: `${today}T08:10:00`,
      updated_at: `${today}T08:40:00`,
    },

    // === งานวันก่อนหน้า (YESTERDAY) ===
    {
      public_id: "tk-mock-11",
      code: "TK-2569-011",
      title: "ตรวจสอบเสาสัญญาณและอาคารโทรคมนาคม ย่านรังสิต",
      task_type: "inspect",
      description:
        "ตรวจเช็กสภาพความปลอดภัยของเสาส่งสัญญาณรถไฟและแนวสายเคเบิลสื่อสารตามแนวเขตทางรถไฟ เสร็จสิ้นสมบูรณ์",
      status: "done",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${yesterday}T16:00:00`,
      lat: 13.9895,
      lng: 100.6035,
      place_name: "สถานีรถไฟรังสิต (ชุมทางรถไฟสายเหนือ)",
      created_at: `${yesterday}T08:30:00`,
      updated_at: `${yesterday}T16:15:00`,
    },
    {
      public_id: "tk-mock-12",
      code: "TK-2569-012",
      title: "ตรวจสอบอาคารที่พักอาศัยพนักงาน ย่านสถานีศาลายา",
      task_type: "inspect",
      description:
        "ตรวจเช็กสภาพอาคารบ้านพักสวัสดิการพนักงาน สำรวจความชำรุดเสียหายเพื่อเสนอของบประมาณซ่อมบำรุงประจำปี",
      status: "done",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${yesterday}T14:00:00`,
      lat: 13.8015,
      lng: 100.3255,
      place_name: "บ้านพักพนักงานรถไฟ สถานีศาลายา",
      created_at: `${yesterday}T09:00:00`,
      updated_at: `${yesterday}T14:20:00`,
    },

    // === งานวันถัดไป (TOMORROW) ===
    {
      public_id: "tk-mock-13",
      code: "TK-2569-013",
      title: "สำรวจจุดทับซ้อนและแนวเขตเวนคืน สถานีนครปฐม",
      task_type: "survey",
      description:
        "เตรียมลงพื้นที่สำรวจรังวัดแปลงที่ดินและหมุดหลักเขตแนวทางคู่ช่วงนครปฐม",
      status: "pending",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${tomorrow}T10:00:00`,
      lat: 13.821,
      lng: 100.061,
      place_name: "สถานีรถไฟนครปฐม (ย่านตะวันตก)",
      created_at: `${today}T16:00:00`,
      updated_at: `${today}T16:00:00`,
    },
    {
      public_id: "tk-mock-14",
      code: "TK-2569-014",
      title: "ตรวจสอบงานปรับปรุงชานชาลา สถานีชุมทางฉะเชิงเทรา",
      task_type: "inspect",
      description:
        "ตรวจรับงานปรับปรุงพื้นชานชาลาและสิ่งอำนวยความสะดวกผู้โดยสารสถานีรถไฟชุมทางฉะเชิงเทรา",
      status: "pending",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${tomorrow}T14:00:00`,
      lat: 13.6965,
      lng: 101.0745,
      place_name: "สถานีรถไฟชุมทางฉะเชิงเทรา",
      created_at: `${today}T15:30:00`,
      updated_at: `${today}T15:30:00`,
    },
  ];
}

const DEFAULT_SAMPLE_TASKS: Task[] = createSampleTasks();

export default function TasksPage() {
  const { lang } = useI18n();
  const th = lang === "th";
  const t = (thTxt: string, enTxt: string) => (th ? thTxt : enTxt);
  const { me, loading, needLogin, serverDown, retry } = useMe();

  const isSup = me?.role === "supervisor" || me?.role === "admin";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activeTab, setActiveTab] = useState<"assigned_by_me" | "my_tasks" | "all" | "members">(
    isSup ? "assigned_by_me" : "my_tasks"
  );
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [filterByDate, setFilterByDate] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [orderedTaskIds, setOrderedTaskIds] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [notice, setNotice] = useState("");
  const [wsOn, setWsOn] = useState(false);
  const [err, setErr] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Custom Confirmation & Alert Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "danger" | "warning" | "primary" | "success";
    isLoading?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
  };

  // 1. Team Management State (Supervisor)
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [myTeam, setMyTeam] = useState<TeamMember[]>([]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviting, setInviting] = useState(false);
  const [memberTasksModal, setMemberTasksModal] = useState<{
    isOpen: boolean;
    member: TeamMember | null;
    mode: "active" | "history";
  }>({ isOpen: false, member: null, mode: "active" });

  // 2. Subordinate Invitation Alerts
  const [myInvitations, setMyInvitations] = useState<TeamMember[]>([]);

  // 3. Accountant Requests State (Supervisor)
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [revisionRequests, setRevisionRequests] = useState<RevisionRequest[]>([]);
  const [reqSearch, setReqSearch] = useState("");
  const [reqStatusFilter, setReqStatusFilter] = useState<"all" | "pending" | "assigned" | "resolved">("all");
  const [reqTypeFilter, setReqTypeFilter] = useState<"all" | "land" | "building">("all");

  // 4. Subordinate Data Submission Modal (Multi-Step Wizard)
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [submittingTask, setSubmittingTask] = useState<Task | null>(null);
  const [submissionStep, setSubmissionStep] = useState<1 | 2 | 3 | 4>(1);
  const [batchItems, setBatchItems] = useState<any[]>([]);
  const [submissionSummary, setSubmissionSummary] = useState("");
  const [submittingData, setSubmittingData] = useState(false);
  const [submissionPhotos, setSubmissionPhotos] = useState<{ id: string; url: string; name: string; caption: string; sizeKb: number }[]>([]);
  const [submissionPolygon, setSubmissionPolygon] = useState<LatLngPoint[]>([]);
  const [submissionArea, setSubmissionArea] = useState<ThaiAreaResult | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; name: string; caption?: string } | null>(null);

  // GPS Navigation State
  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);
  const [navigatingGps, setNavigatingGps] = useState(false);

  // Helpers
  const compressImageFile = (file: File, maxDim = 1280, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const calculateGpsDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  const handleStartNavigation = (destLat: number, destLng: number) => {
    setNavigatingGps(true);
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setNavigatingGps(false);
          const uLat = pos.coords.latitude;
          const uLng = pos.coords.longitude;
          setUserGps({ lat: uLat, lng: uLng });
          const url = `https://www.google.com/maps/dir/?api=1&origin=${uLat},${uLng}&destination=${destLat},${destLng}&travelmode=driving`;
          window.open(url, "_blank");
        },
        () => {
          setNavigatingGps(false);
          const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
          window.open(url, "_blank");
        },
        { timeout: 6000, enableHighAccuracy: true }
      );
    } else {
      setNavigatingGps(false);
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
      window.open(url, "_blank");
    }
  };

  // 5. Supervisor Review Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingTask, setReviewingTask] = useState<Task | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);

  const loadTeam = useCallback(async () => {
    try {
      const data = await fetchMyTeam();
      setMyTeam(Array.isArray(data) ? data : []);
    } catch {
      setMyTeam([]);
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    try {
      const data = await fetchMyInvitations();
      setMyInvitations(Array.isArray(data) ? data : []);
    } catch {
      setMyInvitations([]);
    }
  }, []);

  const loadRevisionRequests = useCallback(async () => {
    try {
      const data = await fetchRevisionRequests();
      setRevisionRequests(Array.isArray(data) ? data : []);
    } catch {
      setRevisionRequests([]);
    }
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    setInviting(true);
    try {
      await inviteToTeam(inviteUsername.trim());
      setInviteUsername("");
      setNotice(`ส่งคำเชิญให้ @${inviteUsername.trim()} เข้าร่วมทีมเรียบร้อยแล้ว`);
      await loadTeam();
    } catch (err: any) {
      setConfirmDialog({
        isOpen: true,
        title: "เกิดข้อผิดพลาดในการส่งคำเชิญ",
        message: err.message || "ไม่สามารถส่งคำเชิญได้ กรุณาตรวจสอบชื่อผู้ใช้งาน (Username) และลองใหม่อีกครั้ง",
        tone: "danger",
        confirmLabel: "รับทราบ",
        onConfirm: closeConfirmDialog,
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = (id: string, name: string, username?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "ยืนยันการนำสมาชิกออกจากทีม",
      message: (
        <div className="text-left space-y-2.5">
          <p className="text-center text-gray-700">
            ท่านต้องการนำคุณ <strong className="text-gray-900 font-semibold">"{name || username || "สมาชิก"}"</strong> {username ? `(@${username})` : ""} ออกจากทีมสำรวจใช่หรือไม่?
          </p>
          <div className="bg-amber-50/80 border border-amber-200/70 p-3 rounded-xl text-[11px] text-amber-900 leading-relaxed">
            ⚠️ <strong>หมายเหตุ:</strong> สมาชิกนี้จะไม่ได้รับมอบหมายงานสำรวจของทีมนี้อีกจนกว่าท่านจะส่งคำเชิญใหม่อีกครั้ง
          </div>
        </div>
      ),
      tone: "danger",
      confirmLabel: "ยืนยันนำออก",
      cancelLabel: "ยกเลิก",
      onCancel: closeConfirmDialog,
      onConfirm: async () => {
        try {
          setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
          await removeTeamMember(id);
          closeConfirmDialog();
          setNotice(`นำสมาชิก "${name || username || ""}" ออกจากทีมเรียบร้อย`);
          await loadTeam();
        } catch (err: any) {
          setConfirmDialog({
            isOpen: true,
            title: "ไม่สามารถนำสมาชิกออกได้",
            message: err.message || "เกิดข้อผิดพลาดในการนำสมาชิกออกจากทีม กรุณาลองใหม่อีกครั้ง",
            tone: "danger",
            confirmLabel: "ตกลง",
            onConfirm: closeConfirmDialog,
          });
        }
      },
    });
  };

  const handleRespondInvitation = async (id: string, action: "accepted" | "declined") => {
    try {
      await respondToInvitation(id, action);
      setNotice(action === "accepted" ? "ยินดีต้อนรับ! ท่านได้เข้าร่วมทีมสำรวจแล้ว" : "ปฏิเสธคำเชิญเข้าร่วมทีมแล้ว");
      await loadInvitations();
      await loadTasks();
    } catch (err: any) {
      setConfirmDialog({
        isOpen: true,
        title: "เกิดข้อผิดพลาด",
        message: err.message || "ไม่สามารถตอบรับคำเชิญได้ กรุณาลองใหม่อีกครั้ง",
        tone: "danger",
        confirmLabel: "ตกลง",
        onConfirm: closeConfirmDialog,
      });
    }
  };

  const initDefaultBatchItems = (targetType?: string | null) => {
    if (targetType === "building") {
      setBatchItems([
        {
          bldg_code: `BL-${new Date().getFullYear() + 543}-${String(Math.floor(Math.random() * 900) + 100)}`,
          name: "",
          land_code: "",
          material_type: "คอนกรีตเสริมเหล็ก",
          num_fl: 2,
          bld_condition_type: "ดี",
          address_no: "",
          subdistrict: "",
          district: "",
          province: "",
          postal_code: "",
        },
      ]);
    } else {
      setBatchItems([
        {
          land_code: `LP-${new Date().getFullYear() + 543}-${String(Math.floor(Math.random() * 900) + 100)}`,
          deed_no: "",
          srt_land_type: "ที่ดินสถานี",
          land_use: "ใช้เพื่อการขนส่ง",
          rai: 1,
          ngan: 0,
          wa: 0,
          width: 20,
          length: 40,
          address_no: "",
          subdistrict: "",
          district: "",
          province: "",
          postal_code: "",
        },
      ]);
    }
  };

  const openSubmissionModal = (task: Task) => {
    setSubmittingTask(task);
    setSubmissionStep(1);

    let existingData: any = null;
    if (task.submission_data) {
      if (typeof task.submission_data === "string") {
        try {
          existingData = JSON.parse(task.submission_data);
        } catch {
          existingData = null;
        }
      } else {
        existingData = task.submission_data;
      }
    }

    if (existingData) {
      setSubmissionSummary(existingData.summary || "");
      if (Array.isArray(existingData.items) && existingData.items.length > 0) {
        setBatchItems(existingData.items);
      } else if (Array.isArray(existingData.lands) && existingData.lands.length > 0) {
        setBatchItems(existingData.lands);
      } else if (Array.isArray(existingData.buildings) && existingData.buildings.length > 0) {
        setBatchItems(existingData.buildings);
      } else {
        initDefaultBatchItems(task.target_type);
      }
      setSubmissionPhotos(existingData.photos || []);
      setSubmissionPolygon(existingData.polygon || []);
      if (existingData.area_sqm) {
        setSubmissionArea({
          sqm: existingData.area_sqm,
          totalWah: (existingData.area_sqm || 0) / 4,
          rai: existingData.rai || 0,
          ngan: existingData.ngan || 0,
          wa: existingData.wa || 0,
          formattedThai:
            existingData.area_thai ||
            `${existingData.rai || 0} ไร่ ${existingData.ngan || 0} งาน ${existingData.wa || 0} ตร.ว.`,
        });
      } else {
        setSubmissionArea(null);
      }
    } else {
      setSubmissionSummary("");
      setSubmissionPhotos([]);
      setSubmissionPolygon([]);
      setSubmissionArea(null);
      initDefaultBatchItems(task.target_type);
    }
    setSubmissionModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const added: { id: string; url: string; name: string; caption: string; sizeKb: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const dataUrl = await compressImageFile(f, 1280, 0.8);
        added.push({
          id: `p_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          url: dataUrl,
          name: f.name,
          caption: "",
          sizeKb: Math.round(dataUrl.length / 1024),
        });
      } catch (err) {
        console.error("Failed to compress image", err);
      }
    }
    setSubmissionPhotos((prev) => [...prev, ...added]);
    e.target.value = "";
  };

  const handleRemovePhoto = (id: string) => {
    setSubmissionPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePhotoCaptionChange = (id: string, caption: string) => {
    setSubmissionPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
  };

  const handlePolygonChange = (points: LatLngPoint[], area: ThaiAreaResult) => {
    setSubmissionPolygon(points);
    setSubmissionArea(area);
    // Auto-fill area into batchItems[0]
    setBatchItems((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((it, idx) => {
        if (idx !== 0) return it;
        if (submittingTask?.target_type === "building") {
          return {
            ...it,
            size_sqm: area.sqm,
            dimension: `${area.sqm} ตร.ม.`,
          };
        } else {
          return {
            ...it,
            rai: area.rai,
            ngan: area.ngan,
            wa: area.wa,
            size_sqm: area.sqm,
            dimension: `${area.rai}-${area.ngan}-${area.wa}`,
          };
        }
      });
    });
  };

  const handleAddBatchItem = () => {
    if (submittingTask?.target_type === "building") {
      setBatchItems((prev) => [
        ...prev,
        {
          bldg_code: `BL-${new Date().getFullYear() + 543}-${String(Math.floor(Math.random() * 900) + 100)}`,
          name: "",
          land_code: "",
          material_type: "คอนกรีตเสริมเหล็ก",
          num_fl: 1,
          bld_condition_type: "ดี",
          address_no: "",
          subdistrict: "",
          district: "",
          province: "",
          postal_code: "",
        },
      ]);
    } else {
      setBatchItems((prev) => [
        ...prev,
        {
          land_code: `LP-${new Date().getFullYear() + 543}-${String(Math.floor(Math.random() * 900) + 100)}`,
          deed_no: "",
          srt_land_type: "ที่ดินสถานี",
          land_use: "ใช้เพื่อการขนส่ง",
          rai: 0,
          ngan: 2,
          wa: 0,
          width: 15,
          length: 30,
          address_no: "",
          subdistrict: "",
          district: "",
          province: "",
          postal_code: "",
        },
      ]);
    }
  };

  const handleRemoveBatchItem = (index: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBatchFieldChange = (index: number, field: string, value: any) => {
    setBatchItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmitTaskData = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!submittingTask) return;
    setSubmittingData(true);
    try {
      const isBldg = submittingTask.target_type === "building";
      await submitTaskData(submittingTask.public_id, {
        summary: submissionSummary.trim() || undefined,
        items: batchItems,
        lands: !isBldg ? (batchItems as any) : undefined,
        buildings: isBldg ? (batchItems as any) : undefined,
        photos: submissionPhotos,
        polygon: submissionPolygon,
        area_sqm: submissionArea?.sqm,
        area_thai: submissionArea?.formattedThai,
        rai: submissionArea?.rai,
        ngan: submissionArea?.ngan,
        wa: submissionArea?.wa,
      });
      setSubmissionModalOpen(false);
      setNotice(`ส่งข้อมูลงาน "${submittingTask.title}" ให้หัวหน้างานตรวจสอบเรียบร้อยแล้ว`);
      await loadTasks();
      if (selectedTask?.public_id === submittingTask.public_id) {
        setSelectedTask(null);
      }
    } catch (err: any) {
      setConfirmDialog({
        isOpen: true,
        title: "เกิดข้อผิดพลาดในการส่งข้อมูล",
        message: err.message || "ไม่สามารถบันทึกและส่งข้อมูลงานได้ กรุณาลองใหม่อีกครั้ง",
        tone: "danger",
        confirmLabel: "ตกลง",
        onConfirm: closeConfirmDialog,
      });
    } finally {
      setSubmittingData(false);
    }
  };

  const openReviewModal = (task: Task) => {
    setReviewingTask(task);
    setReviewFeedback("");
    setReviewModalOpen(true);
  };

  const handleReviewAction = async (decision: "approve" | "reject") => {
    if (!reviewingTask) return;
    if (decision === "reject" && !reviewFeedback.trim()) {
      setConfirmDialog({
        isOpen: true,
        title: "กรุณาระบุข้อเสนอแนะ",
        message: "กรุณาระบุข้อเสนอแนะหรือสิ่งที่ต้องการให้ผู้ปฏิบัติงานแก้ไข ก่อนส่งงานกลับ",
        tone: "warning",
        confirmLabel: "เข้าใจแล้ว",
        onConfirm: closeConfirmDialog,
      });
      return;
    }
    setIsReviewing(true);
    try {
      await reviewTask(
        reviewingTask.public_id,
        decision,
        decision === "reject" ? reviewFeedback.trim() : undefined
      );
      setReviewModalOpen(false);
      if (decision === "approve") {
        setNotice(`อนุมัติงาน "${reviewingTask.title}" เรียบร้อยแล้ว ข้อมูลถูกบันทึกลงระบบจริงแล้ว`);
      } else {
        setNotice(`ส่งงาน "${reviewingTask.title}" กลับให้ลูกน้องแก้ไขเรียบร้อยแล้ว`);
      }
      await loadTasks();
      if (selectedTask?.public_id === reviewingTask.public_id) {
        setSelectedTask(null);
      }
    } catch (err: any) {
      setConfirmDialog({
        isOpen: true,
        title: "เกิดข้อผิดพลาดในการตรวจสอบงาน",
        message: err.message || "ไม่สามารถบันทึกผลการตรวจสอบงานได้ กรุณาลองใหม่อีกครั้ง",
        tone: "danger",
        confirmLabel: "ตกลง",
        onConfirm: closeConfirmDialog,
      });
    } finally {
      setIsReviewing(false);
    }
  };

  // อัปเดตแท็บเริ่มต้นตามบทบาทเมื่อ me โหลดเสร็จ
  useEffect(() => {
    if (me?.role === "subordinate") {
      setActiveTab("my_tasks");
    } else if (me?.role === "supervisor" || me?.role === "admin") {
      setActiveTab("assigned_by_me");
    }
  }, [me?.role]);

  const loadTasks = useCallback(async () => {
    const todayStr = getTodayStr();
    const cacheKey = "ams_saved_tasks_v5";

    try {
      const data = await api<Task[]>("/api/tasks");
      if (Array.isArray(data) && data.length > 0) {
        setTasks(data);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(cacheKey, JSON.stringify(data));
        }
        return;
      }
    } catch {
      /* ignore api error */
    }

    // Fallback เมื่อออฟไลน์หรือไม่มีข้อมูล
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const validTasks = parsed.filter((t: any) => t && typeof t === "object" && t.public_id && t.status);
            const hasToday = validTasks.some((t: Task) => getTaskDateStr(t) === todayStr);
            if (hasToday && validTasks.length >= 8) {
              setTasks(validTasks);
              return;
            }
          }
        } catch {
          /* ignore parse error */
        }
      }

      // สร้างชุดข้อมูลใหม่สำหรับวันนี้ทันที (14 รายการ)
      const fresh = createSampleTasks(todayStr);
      setTasks(fresh);
      window.localStorage.setItem(cacheKey, JSON.stringify(fresh));
      window.localStorage.removeItem("ams_saved_tasks");
    }
  }, []);

  const handleReloadSampleTasks = () => {
    const todayStr = getTodayStr();
    const fresh = createSampleTasks(todayStr);
    setTasks(fresh);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ams_saved_tasks_v5", JSON.stringify(fresh));
      window.localStorage.removeItem("ams_saved_tasks");
    }
    setNotice(th ? "รีเซ็ตและโหลดข้อมูลตัวอย่างงานประจำวันนี้เรียบร้อยแล้ว (14 รายการ)" : "Sample tasks for today reloaded (14 tasks)");
    setTimeout(() => setNotice(""), 4000);
  };

  const loadUsers = useCallback(async () => {
    try {
      const res = await api<AppUser[]>("/api/users");
      setUsers(Array.isArray(res) ? res : []);
    } catch {
      // Mock users fallback
      setUsers([
        {
          public_id: "usr-leader",
          username: "leader",
          display_name: "หัวหน้างานสำรวจ",
          picture_url: null,
          role: "supervisor",
          created_at: new Date().toISOString(),
        },
        {
          public_id: "usr-normal",
          username: "normal",
          display_name: "เจ้าหน้าที่สำรวจ",
          picture_url: null,
          role: "subordinate",
          created_at: new Date().toISOString(),
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    let mounted = true;
    loadTasks();
    if (isSup) {
      loadUsers();
      loadTeam();
      loadRevisionRequests();
    } else {
      loadInvitations();
    }

    const off = connectTaskWS(
      (e) => {
        if (!mounted) return;
        loadTasks();
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        if (e.type === "task.new") {
          setNotice(
            th
              ? `ได้รับมอบหมายงานใหม่: ${e.task.title} — สั่งโดย ${e.task.assigner_name}`
              : `New task assigned: ${e.task.title}`
          );
        } else {
          setNotice(
            th
              ? `งาน ${e.task.code || ""} อัปเดตสถานะเป็น: ${STATUS_LABEL[e.task.status]}`
              : `Task ${e.task.code || ""} updated: ${e.task.status}`
          );
        }
        noticeTimer.current = setTimeout(() => setNotice(""), 6000);
      },
      setWsOn
    );

    return () => {
      mounted = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, isSup]);

  useEffect(() => {
    const handleDataUpdate = () => {
      loadTasks();
      if (isSup) {
        loadTeam();
        loadRevisionRequests();
      } else {
        loadInvitations();
      }
    };
    window.addEventListener("ams_data_updated", handleDataUpdate);
    return () => window.removeEventListener("ams_data_updated", handleDataUpdate);
  }, [isSup, loadTasks, loadTeam, loadRevisionRequests, loadInvitations]);

  const clearUrlParam = useCallback((paramKey: string) => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has(paramKey)) {
        url.searchParams.delete(paramKey);
        const searchStr = url.searchParams.toString();
        const newUrl = url.pathname + (searchStr ? `?${searchStr}` : "") + url.hash;
        window.history.replaceState(null, "", newUrl);
      }
    } catch {}
  }, []);

  const handleCloseTaskModal = useCallback(() => {
    setSelectedTask(null);
    clearUrlParam("task_id");
  }, [clearUrlParam]);

  // ล้างค่า URL query parameter เมื่อปิด Modal แต่ละตัว เพื่อไม่ให้เด้งซ้ำเมื่อรีเฟรชหน้า
  useEffect(() => {
    if (!selectedTask) {
      clearUrlParam("task_id");
    }
  }, [selectedTask, clearUrlParam]);

  useEffect(() => {
    if (!reviewModalOpen) {
      clearUrlParam("review_task_id");
    }
  }, [reviewModalOpen, clearUrlParam]);

  useEffect(() => {
    if (!teamModalOpen) {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.get("open") === "team") {
          clearUrlParam("open");
        }
      }
    }
  }, [teamModalOpen, clearUrlParam]);

  useEffect(() => {
    if (!requestsModalOpen) {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.get("open") === "requests") {
          clearUrlParam("open");
        }
      }
    }
  }, [requestsModalOpen, clearUrlParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkParams = () => {
      const params = new URLSearchParams(window.location.search);
      const open = params.get("open");
      const reviewTaskId = params.get("review_task_id");
      const taskId = params.get("task_id");
      const tab = params.get("tab");

      if (open === "team") setTeamModalOpen(true);
      if (open === "requests") setRequestsModalOpen(true);
      if (tab === "my_tasks" || tab === "assigned_by_me" || tab === "all" || tab === "members") {
        setActiveTab(tab);
      }

      if (reviewTaskId) {
        const found = tasks.find((t) => t.public_id === reviewTaskId);
        if (found) {
          setReviewingTask(found);
          setReviewFeedback("");
          setReviewModalOpen(true);
        } else if (tasks.length > 0) {
          api<Task[]>("/api/tasks").then((list) => {
            if (Array.isArray(list)) {
              const f = list.find((t) => t.public_id === reviewTaskId);
              if (f) {
                setReviewingTask(f);
                setReviewFeedback("");
                setReviewModalOpen(true);
              }
            }
          }).catch(() => {});
        }
      }

      if (taskId) {
        const found = tasks.find((t) => t.public_id === taskId);
        if (found) {
          setSelectedTask(found);
        } else if (tasks.length > 0) {
          api<Task[]>("/api/tasks").then((list) => {
            if (Array.isArray(list)) {
              const f = list.find((t) => t.public_id === taskId);
              if (f) setSelectedTask(f);
            }
          }).catch(() => {});
        }
      }
    };

    checkParams();
    window.addEventListener("popstate", checkParams);

    // รับอีเวนต์เปิดงานทันทีเมื่อคลิกจากกล่องแจ้งเตือน (แก้ปัญหาครั้งแรกกดไม่ขึ้นเมื่ออยู่ในหน้านี้อยู่แล้ว)
    const handleOpenTask = (e: any) => {
      const targetId = e.detail?.taskId;
      if (!targetId) return;
      const found = tasks.find((t) => t.public_id === targetId);
      if (found) {
        setSelectedTask(found);
      } else {
        api<Task[]>("/api/tasks").then((list) => {
          if (Array.isArray(list)) {
            const f = list.find((t) => t.public_id === targetId);
            if (f) {
              setTasks(list);
              setSelectedTask(f);
            }
          }
        }).catch(() => {});
      }
    };

    const handleOpenReview = (e: any) => {
      const targetId = e.detail?.reviewTaskId;
      if (!targetId) return;
      const found = tasks.find((t) => t.public_id === targetId);
      if (found) {
        setReviewingTask(found);
        setReviewFeedback("");
        setReviewModalOpen(true);
      } else {
        api<Task[]>("/api/tasks").then((list) => {
          if (Array.isArray(list)) {
            const f = list.find((t) => t.public_id === targetId);
            if (f) {
              setTasks(list);
              setReviewingTask(f);
              setReviewFeedback("");
              setReviewModalOpen(true);
            }
          }
        }).catch(() => {});
      }
    };

    const handleOpenModal = (e: any) => {
      const mode = e.detail?.open;
      if (mode === "team") setTeamModalOpen(true);
      if (mode === "requests") setRequestsModalOpen(true);
    };

    window.addEventListener("ams_open_task", handleOpenTask);
    window.addEventListener("ams_open_review", handleOpenReview);
    window.addEventListener("ams_open_modal", handleOpenModal);

    return () => {
      window.removeEventListener("popstate", checkParams);
      window.removeEventListener("ams_open_task", handleOpenTask);
      window.removeEventListener("ams_open_review", handleOpenReview);
      window.removeEventListener("ams_open_modal", handleOpenModal);
    };
  }, [tasks]);

  async function setStatus(task: Task, status: TaskStatus) {
    setErr("");
    try {
      await api<Task>(`/api/tasks/${task.public_id}/status`, { method: "PATCH", json: { status } });
      loadTasks();
    } catch {
      // อัปเดตใน Local State หาก API ล้มเหลวหรือออฟไลน์
      setTasks((prev) => {
        const next = prev.map((t) => (t.public_id === task.public_id ? { ...t, status } : t));
        if (typeof window !== "undefined") {
          window.localStorage.setItem("ams_saved_tasks_v5", JSON.stringify(next));
        }
        return next;
      });
    }

    // ซิงค์ modal ที่เปิดอยู่ด้วย
    setSelectedTask((prev) => (prev && prev.public_id === task.public_id ? { ...prev, status } : prev));
  }

  async function changeRole(publicId: string, role: string) {
    try {
      await api(`/api/users/${publicId}/role`, { method: "PATCH", json: { role } });
      loadUsers();
    } catch (e) {
      setConfirmDialog({
        isOpen: true,
        title: "เกิดข้อผิดพลาดในการเปลี่ยนสิทธิ์",
        message: (e as Error).message || "ไม่สามารถเปลี่ยนสิทธิ์ผู้ใช้งานได้",
        tone: "danger",
        confirmLabel: "ตกลง",
        onConfirm: closeConfirmDialog,
      });
    }
  }

  // คัดกรองงานตามแท็บที่เลือก
  const currentTabTasks = useMemo(() => {
    return (tasks || []).filter((task) => {
      if (!task) return false;
      if (activeTab === "assigned_by_me") {
        return (
          task.assigner_public_id === me?.public_id ||
          task.assigner_name === me?.display_name ||
          isSup
        );
      }
      if (activeTab === "my_tasks") {
        return (
          task.assignee_public_id === me?.public_id ||
          task.assignee_name === me?.display_name ||
          !isSup
        );
      }
      return true; // all
    });
  }, [tasks, activeTab, me?.public_id, me?.display_name, isSup]);

  // คัดกรองงานตามวันที่เลือก
  const dateFilteredTasks = useMemo(() => {
    return currentTabTasks.filter((task) => {
      if (!task) return false;
      if (!filterByDate) return true;
      const tDate = getTaskDateStr(task);
      const createdDate = getTaskCreatedDateStr(task);

      // 1. ถ้าตรงกับวันที่เลือกโดยตรง (ไม่ว่าจะเป็นวันกำหนดเสร็จ หรือวันที่สั่ง/สร้างงาน)
      if (tDate === selectedDate || createdDate === selectedDate) {
        return true;
      }

      // 2. ถ้าเปิดดูหน้า "วันนี้" (selectedDate === getTodayStr()):
      // แสดงงานที่กำลังรอทำหรือกำลังดำเนินการอยู่ (pending, accepted, in_progress, submitted, revision_requested)
      // เพื่อให้ลูกน้องและหัวหน้าเห็นภารกิจจริงที่ต้องรับผิดชอบในปัจจุบัน ไม่พลาดงานที่สั่งไว้
      const isToday = selectedDate === getTodayStr();
      if (isToday) {
        const isActive = task.status !== "done" && task.status !== "cancelled";
        if (isActive) return true;
      }

      return false;
    });
  }, [currentTabTasks, filterByDate, selectedDate]);

  // คัดกรองงานตามสถานะที่เลือกจากปุ่ม Filter Cards
  const displayedTasks = useMemo(() => {
    return dateFilteredTasks.filter((task) => {
      if (!task) return false;
      if (statusFilter === "all") return true;
      if (statusFilter === "in_progress") {
        return task.status === "in_progress" || task.status === "accepted";
      }
      return task.status === statusFilter;
    });
  }, [dateFilteredTasks, statusFilter]);

  // สถิติยอดงาน (5 ช่องสำหรับปุ่ม Filter)
  const baseForStats = filterByDate ? dateFilteredTasks : currentTabTasks;
  const stats = useMemo(() => ({
    total: baseForStats.length,
    pending: baseForStats.filter((t) => t?.status === "pending").length,
    inProgress: baseForStats.filter((t) => t?.status === "in_progress" || t?.status === "accepted").length,
    done: baseForStats.filter((t) => t?.status === "done").length,
    cancelled: baseForStats.filter((t) => t?.status === "cancelled").length,
  }), [baseForStats]);

  // อัปเดต orderedTaskIds เริ่มต้นเมื่อ dateFilteredTasks เปลี่ยน
  useEffect(() => {
    const ids = dateFilteredTasks.map((t) => t?.public_id).filter(Boolean) as string[];
    setOrderedTaskIds((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const newlyAdded = ids.filter((id) => !kept.includes(id));
      return [...kept, ...newlyAdded];
    });
  }, [dateFilteredTasks]);

  const handlePrevDay = () => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() - 1);
    const newStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    setSelectedDate(newStr);
    setFilterByDate(true);
  };

  const handleNextDay = () => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + 1);
    const newStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    setSelectedDate(newStr);
    setFilterByDate(true);
  };

  const getStepIndex = (status: TaskStatus) => {
    switch (status) {
      case "pending":
        return 0;
      case "accepted":
        return 1;
      case "in_progress":
      case "revision_requested":
        return 2;
      case "submitted":
        return 3;
      case "done":
        return 4;
      default:
        return -1;
    }
  };

  // การเลื่อนขั้นตอนทีละสเต็ปตามลำดับ (Sequential Progression: ค่อยๆ ไป ไม่กดข้าม ยกเว้น ยกเลิก)
  const handleAdvancePipeline = (targetIdx: number) => {
    if (!selectedTask) return;
    const targetStep = PIPELINE_STEPS[targetIdx];
    if (!targetStep) return;

    // หากงานถูกยกเลิกแล้ว
    if (selectedTask.status === "cancelled") {
      setConfirmDialog({
        isOpen: true,
        title: "งานนี้ถูกยกเลิกแล้ว",
        message: "งานนี้อยู่ในสถานะยกเลิก หากต้องการดำเนินการต่อ กรุณากดปุ่ม 'กู้คืนสถานะกลับมา'",
        tone: "primary",
        confirmLabel: "เข้าใจแล้ว",
        cancelLabel: "ปิด",
        onCancel: closeConfirmDialog,
        onConfirm: closeConfirmDialog,
      });
      return;
    }

    const curIdx = getStepIndex(selectedTask.status);

    const isAssignee = Boolean(
      me && (
        selectedTask.assignee_public_id === me.public_id ||
        selectedTask.assignee_name === me.display_name
      )
    );

    // ตรวจสอบสิทธิ์: ขั้นตอน 0 -> 1, 1 -> 2, 2 -> 3 (รับงาน, ลงพื้นที่, ส่งตรวจ) เฉพาะผู้รับมอบหมายงาน (เจ้าของงาน) เท่านั้น
    if (!isAssignee && targetIdx < 4) {
      setConfirmDialog({
        isOpen: true,
        title: "เฉพาะผู้รับมอบหมายงานเท่านั้นที่มีสิทธิ์ดำเนินการ",
        message: (
          <div className="space-y-2 text-left">
            <p className="text-gray-700 text-center">
              งานนี้มอบหมายให้คุณ <strong className="text-gray-900 font-semibold">"{selectedTask.assignee_name || "เจ้าหน้าที่สำรวจ"}"</strong> เป็นผู้รับผิดชอบ
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <span>
                หัวหน้างานไม่มีสิทธิ์กดรับงานหรือเปลี่ยนสถานะการลงพื้นที่แทนลูกน้อง เฉพาะเจ้าของงานที่เป็นผู้สำรวจจริงเท่านั้นที่สามารถดำเนินการได้
              </span>
            </div>
            <p className="text-[11px] text-gray-500 text-center">
              (หากหัวหน้างานต้องการลงพื้นที่สำรวจเอง สามารถเลือกมอบหมายงานให้ตัวเองได้ตอนสั่งงานใหม่)
            </p>
          </div>
        ),
        tone: "warning",
        confirmLabel: "รับทราบ",
        cancelLabel: "ปิด",
        onCancel: closeConfirmDialog,
        onConfirm: closeConfirmDialog,
      });
      return;
    }

    // 1. ถ้าคลิกขั้นตอนเดิม
    if (targetIdx === curIdx) {
      if (selectedTask.status === "in_progress" || selectedTask.status === "revision_requested") {
        const t = selectedTask;
        handleCloseTaskModal();
        openSubmissionModal(t);
      } else if (selectedTask.status === "submitted" && isSup) {
        const t = selectedTask;
        handleCloseTaskModal();
        openReviewModal(t);
      }
      return;
    }

    // 2. ถ้าคลิกขั้นตอนที่ผ่านมาแล้ว (targetIdx < curIdx)
    if (targetIdx < curIdx) {
      setConfirmDialog({
        isOpen: true,
        title: "ขั้นตอนนี้ดำเนินการผ่านไปแล้ว",
        message: `ขั้นตอน "${targetStep.label}" (${targetStep.sub}) ได้ดำเนินการเสร็จเรียบร้อยแล้ว`,
        tone: "primary",
        confirmLabel: "รับทราบ",
        cancelLabel: "ปิด",
        onCancel: closeConfirmDialog,
        onConfirm: closeConfirmDialog,
      });
      return;
    }

    // 3. ถ้าพยายามกระโดดข้ามขั้นตอน (targetIdx > curIdx + 1)
    if (targetIdx > curIdx + 1) {
      const nextStep = PIPELINE_STEPS[curIdx + 1];
      setConfirmDialog({
        isOpen: true,
        title: "ไม่สามารถข้ามขั้นตอนได้",
        message: (
          <div className="space-y-2 text-left">
            <p className="text-gray-700 text-center">
              ระบบกำหนดให้ดำเนินงานตามลำดับขั้นตอน ค่อยๆ ไปทีละขั้นตอน ไม่สามารถกดข้ามขั้นตอนได้
            </p>
            {nextStep && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <span>
                  ขั้นตอนถัดไปที่ต้องทำคือ: <strong>ขั้นตอนที่ {curIdx + 2} "{nextStep.label}"</strong> ({nextStep.sub})
                </span>
              </div>
            )}
          </div>
        ),
        tone: "warning",
        confirmLabel: "รับทราบ",
        cancelLabel: "ย้อนกลับ",
        onCancel: closeConfirmDialog,
        onConfirm: closeConfirmDialog,
      });
      return;
    }

    // 4. กรณีเป็นขั้นตอนถัดไปทันที (targetIdx === curIdx + 1)
    if (targetIdx === curIdx + 1) {
      // Step 0 -> Step 1: pending -> accepted
      if (curIdx === 0 && targetIdx === 1) {
        setStatus(selectedTask, "accepted");
        setSelectedTask((prev) => (prev ? { ...prev, status: "accepted" } : null));
        return;
      }

      // Step 1 -> Step 2: accepted -> in_progress
      if (curIdx === 1 && targetIdx === 2) {
        setStatus(selectedTask, "in_progress");
        setSelectedTask((prev) => (prev ? { ...prev, status: "in_progress" } : null));
        return;
      }

      // Step 2 -> Step 3: in_progress / revision_requested -> submitted
      if (curIdx === 2 && targetIdx === 3) {
        const t = selectedTask;
        handleCloseTaskModal();
        openSubmissionModal(t);
        return;
      }

      // Step 3 -> Step 4: submitted -> done
      if (curIdx === 3 && targetIdx === 4) {
        if (isSup) {
          const t = selectedTask;
          handleCloseTaskModal();
          openReviewModal(t);
        } else {
          setConfirmDialog({
            isOpen: true,
            title: "อยู่ระหว่างรอหัวหน้างานตรวจสอบ",
            message: "งานนี้ได้ส่งผลงานแล้ว อยู่ระหว่างรอหัวหน้างานตรวจสอบและอนุมัติเข้าระบบ (พนักงานสำรวจไม่สามารถอนุมัติงานให้เสร็จสิ้นได้ด้วยตนเอง)",
            tone: "primary",
            confirmLabel: "รับทราบ",
            cancelLabel: "ปิด",
            onCancel: closeConfirmDialog,
            onConfirm: closeConfirmDialog,
          });
        }
        return;
      }
    }
  };

  return (
    <Page allowedRoles={["admin", "supervisor", "subordinate"]}>
      {!API_CONFIGURED && !me && (
        <div className="py-16 text-center">
          <ClipboardList size={40} className="mx-auto text-gray-300" />
          <h1 className="text-lg font-semibold text-govblue-800 mt-4">
            {t("ระบบสั่งงานยังไม่เชื่อมต่อหลังบ้าน", "Task system not connected")}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {t(
              "ตั้งค่า NEXT_PUBLIC_API_URL ชี้มาที่ Go backend แล้ว deploy ใหม่",
              "Set NEXT_PUBLIC_API_URL to your Go backend and redeploy"
            )}
          </p>
        </div>
      )}

      {API_CONFIGURED && loading && (
        <div className="py-16 text-center text-gray-400 animate-pulse">
          {t("กำลังตรวจสอบสิทธิ์ผู้ใช้งาน...", "Verifying user credentials...")}
        </div>
      )}

      {API_CONFIGURED && !loading && serverDown && (
        <div className="py-16 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
            <Radio size={26} className="text-amber-600" />
          </div>
          <h1 className="text-lg font-semibold text-govblue-800 mt-4">
            {t("เซิร์ฟเวอร์กำลังเริ่มทำงาน", "Server is waking up")}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {t(
              "เซิร์ฟเวอร์ระบบกำลังเริ่มต้นทำงาน โปรดรอสักครู่แล้วกดลองใหม่",
              "The server is waking up, please wait a moment and retry"
            )}
          </p>
          <button
            onClick={retry}
            className="mt-6 w-full bg-govblue-700 hover:bg-govblue-600 text-white font-medium py-2.5 rounded-lg transition"
          >
            {t("ลองเชื่อมต่อใหม่", "Retry connection")}
          </button>
        </div>
      )}

      {API_CONFIGURED && !loading && needLogin && !me && (
        <div className="py-16 text-center max-w-md mx-auto">
          <ClipboardList size={40} className="mx-auto text-govblue-600" />
          <h1 className="text-lg font-semibold text-govblue-800 mt-4">
            {t("เข้าสู่ระบบเพื่อดูงานและสั่งงาน", "Sign in to view tasks")}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {t(
              "กรุณาเข้าสู่ระบบด้วยบัญชีผู้ใช้ของคุณ เพื่อดูงานที่ได้รับมอบหมายหรือสั่งงานภาคสนาม",
              "Sign in to access your assigned tasks or create new assignments"
            )}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block w-full bg-govblue-700 hover:bg-govblue-600 text-white font-medium py-2.5 rounded-lg text-center shadow-sm transition"
          >
            {t("ไปหน้าเข้าสู่ระบบ", "Go to Sign in")}
          </Link>
        </div>
      )}

      {me && (
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-govblue-50 text-govblue-800">
                  <ClipboardList size={22} />
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-govblue-900">
                  {isSup
                    ? t("ระบบมอบหมายและติดตามงาน", "Task Management & Assignment")
                    : t("งานของฉัน (My Tasks)", "My Tasks")}
                </h1>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-700">{me.display_name}</span>
                <span>•</span>
                <span>
                  {me.role === "supervisor"
                    ? t("หัวหน้างาน", "Supervisor")
                    : me.role === "admin"
                    ? t("ผู้ดูแลระบบ", "Administrator")
                    : t("เจ้าหน้าที่สำรวจภาคสนาม", "Field Survey Officer")}
                </span>
                <span>•</span>
                <span
                  className={`inline-flex items-center gap-1.5 ${
                    wsOn ? "text-emerald-600 font-medium" : "text-gray-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      wsOn ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
                    }`}
                  />
                  {wsOn
                    ? t("ออนไลน์", "Online")
                    : t("กำลังเชื่อมต่อระบบ...", "Connecting...")}
                </span>
              </p>
            </div>

            {isSup && (
              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setRequestsModalOpen(true)}
                  className="relative inline-flex items-center justify-center gap-1.5 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs sm:text-sm font-semibold px-3 py-2 rounded-lg shadow-xs transition"
                >
                  <AlertCircle size={16} className="text-amber-600" />
                  <span>คำร้องจากบัญชี</span>
                  {(Array.isArray(revisionRequests) ? revisionRequests : []).filter((r) => r && r.status === "pending").length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {(Array.isArray(revisionRequests) ? revisionRequests : []).filter((r) => r && r.status === "pending").length}
                    </span>
                  )}
                </button>


                <Link
                  href="/tasks/new"
                  className="inline-flex items-center justify-center gap-2 bg-govblue-700 hover:bg-govblue-800 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition"
                >
                  <Plus size={18} /> {t("สั่งงานใหม่", "New Task")}
                </Link>
              </div>
            )}
          </div>

          {/* Subordinate Team Invitation Banner */}
          {!isSup && (Array.isArray(myInvitations) ? myInvitations : []).length > 0 && (
            <div className="space-y-2 mb-2 animate-in fade-in">
              {(Array.isArray(myInvitations) ? myInvitations : []).map((inv) => {
                if (!inv) return null;
                return (
                  <div
                    key={inv.id || inv.supervisor_public_id}
                    className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-govblue-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Users size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-govblue-900">
                          คำเชิญเข้าร่วมทีมสำรวจ (Team Invitation)
                        </div>
                        <div className="text-xs text-govblue-700 mt-0.5">
                          หัวหน้างาน <span className="font-semibold text-gray-900">{inv.supervisor_name}</span> ได้ส่งคำเชิญให้ท่านเข้าร่วมทีม
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleRespondInvitation(inv.supervisor_public_id, "accepted")}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 transition"
                      >
                        <Check size={14} /> ยอมรับเข้าร่วมทีม
                      </button>
                      <button
                        onClick={() => handleRespondInvitation(inv.supervisor_public_id, "declined")}
                        className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-medium transition"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Alert Notice Banner */}
          {notice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-4 py-3 flex items-center gap-2.5 shadow-sm animate-in fade-in">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{notice}</span>
            </div>
          )}
          {err && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-3 flex items-center gap-2.5 shadow-sm">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* Metric Summary Filter Cards (5 สถานะ สามารถกดเพื่อกรองงานได้) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {/* 1. งานทั้งหมด */}
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex items-center justify-between gap-2 shadow-xs group ${
                statusFilter === "all"
                  ? "bg-govblue-50/90 border-govblue-600 ring-2 ring-govblue-500/20 shadow-sm"
                  : "bg-white border-gray-200 hover:border-govblue-300 hover:bg-gray-50/80"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition ${
                    statusFilter === "all"
                      ? "bg-govblue-700 text-white shadow-xs"
                      : "bg-govblue-50 text-govblue-700 group-hover:bg-govblue-100"
                  }`}
                >
                  <Layers size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-gray-500 truncate">
                    {t("งานทั้งหมด", "Total Tasks")}
                  </div>
                  <div className="text-lg font-bold text-gray-900 leading-tight">{stats.total}</div>
                </div>
              </div>
              {statusFilter === "all" && (
                <span className="w-2 h-2 rounded-full bg-govblue-600 shrink-0" />
              )}
            </button>

            {/* 2. รอรับงาน (หมุดสีขาว) */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
              className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex items-center justify-between gap-2 shadow-xs group ${
                statusFilter === "pending"
                  ? "bg-amber-50/90 border-amber-500 ring-2 ring-amber-400/20 shadow-sm"
                  : "bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50/30"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border transition ${
                    statusFilter === "pending"
                      ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                      : "bg-amber-50 text-amber-600 border-amber-200 group-hover:bg-amber-100"
                  }`}
                >
                  <Clock size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-amber-700 truncate flex items-center gap-1">
                    <span>{t("รอรับงาน", "Pending")}</span>
                    <span className="inline-block w-2 h-2 rounded-full bg-white border border-gray-400 shrink-0" title="หมุดสีขาวบนแผนที่" />
                  </div>
                  <div className="text-lg font-bold text-amber-900 leading-tight">{stats.pending}</div>
                </div>
              </div>
              {statusFilter === "pending" && (
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              )}
            </button>

            {/* 3. กำลังปฏิบัติงาน (หมุดสีฟ้าอ่อน) */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
              className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex items-center justify-between gap-2 shadow-xs group ${
                statusFilter === "in_progress"
                  ? "bg-sky-50/90 border-sky-500 ring-2 ring-sky-400/20 shadow-sm"
                  : "bg-white border-gray-200 hover:border-sky-300 hover:bg-sky-50/30"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition ${
                    statusFilter === "in_progress"
                      ? "bg-sky-500 text-white shadow-xs"
                      : "bg-sky-50 text-sky-600 group-hover:bg-sky-100"
                  }`}
                >
                  <PlayCircle size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-sky-700 truncate flex items-center gap-1">
                    <span>{t("กำลังปฏิบัติงาน", "In Progress")}</span>
                    <span className="inline-block w-2 h-2 rounded-full bg-sky-400 border border-sky-500 shrink-0" title="หมุดสีฟ้าอ่อนบนแผนที่" />
                  </div>
                  <div className="text-lg font-bold text-sky-900 leading-tight">{stats.inProgress}</div>
                </div>
              </div>
              {statusFilter === "in_progress" && (
                <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
              )}
            </button>

            {/* 4. เสร็จสิ้น (หมุดสีเขียว) */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "done" ? "all" : "done")}
              className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex items-center justify-between gap-2 shadow-xs group ${
                statusFilter === "done"
                  ? "bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-400/20 shadow-sm"
                  : "bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition ${
                    statusFilter === "done"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"
                  }`}
                >
                  <CheckCircle2 size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-emerald-700 truncate flex items-center gap-1">
                    <span>{t("เสร็จสิ้น", "Done")}</span>
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="หมุดสีเขียวบนแผนที่" />
                  </div>
                  <div className="text-lg font-bold text-emerald-900 leading-tight">{stats.done}</div>
                </div>
              </div>
              {statusFilter === "done" && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              )}
            </button>

            {/* 5. ยกเลิก (หมุดสีแดง) */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "cancelled" ? "all" : "cancelled")}
              className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex items-center justify-between gap-2 shadow-xs group col-span-2 sm:col-span-1 ${
                statusFilter === "cancelled"
                  ? "bg-rose-50/90 border-rose-500 ring-2 ring-rose-400/20 shadow-sm"
                  : "bg-white border-gray-200 hover:border-rose-300 hover:bg-rose-50/30"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition ${
                    statusFilter === "cancelled"
                      ? "bg-rose-500 text-white shadow-xs"
                      : "bg-rose-50 text-rose-600 group-hover:bg-rose-100"
                  }`}
                >
                  <X size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-rose-700 truncate flex items-center gap-1">
                    <span>{t("ยกเลิก", "Cancelled")}</span>
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500 shrink-0" title="หมุดสีแดงบนแผนที่" />
                  </div>
                  <div className="text-lg font-bold text-rose-900 leading-tight">{stats.cancelled}</div>
                </div>
              </div>
              {statusFilter === "cancelled" && (
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              )}
            </button>
          </div>

          {/* Navigation Tabs (สำหรับหัวหน้า / เจ้าหน้าที่) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              {isSup ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab("assigned_by_me")}
                    className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                      activeTab === "assigned_by_me"
                        ? "bg-govblue-800 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <ClipboardList size={15} />
                    {t("งานที่ฉันสั่ง", "Tasks I Assigned")}
                    <span className="ml-1 text-[11px] px-1.5 py-0.2 rounded-full bg-white/20">
                      {(Array.isArray(tasks) ? tasks : []).filter((t) => t && (t.assigner_public_id === me?.public_id || isSup)).length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("my_tasks")}
                    className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                      activeTab === "my_tasks"
                        ? "bg-govblue-800 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Users size={15} />
                    {t("งานของฉัน", "Assigned to Me")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("all")}
                    className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                      activeTab === "all"
                        ? "bg-govblue-800 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {t("งานทั้งหมด", "All Tasks")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("members")}
                    className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                      activeTab === "members"
                        ? "bg-govblue-800 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Users size={15} />
                    <span>{t("สมาชิกในสังกัด", "Team Members")}</span>
                    {(Array.isArray(myTeam) ? myTeam : []).filter((m) => m && m.status === "accepted").length > 0 && (
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                          activeTab === "members"
                            ? "bg-white/20 text-white"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {(Array.isArray(myTeam) ? myTeam : []).filter((m) => m && m.status === "accepted").length}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-sm font-semibold text-govblue-900 px-1 py-1">
                  <ClipboardList size={16} />
                  <span>{t("รายการงานที่ได้รับมอบหมาย", "Assigned Tasks List")}</span>
                </div>
              )}
            </div>

          </div>

          {/* Date Navigation & View Mode Switcher Toolbar (คัดกรองงานในวันนั้นๆ & สลับดูแผนที่รวม) */}
          {activeTab !== "members" && (
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Date Navigator */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 shrink-0">
                  <Calendar size={15} className="text-govblue-700" />
                  <span>{t("ภารกิจประจำวัน:", "Daily Tasks:")}</span>
                </span>

                <div className="inline-flex items-center bg-gray-50 border border-gray-300 rounded-lg overflow-hidden shadow-xs">
                  {/* Prev Day Button */}
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    title="วันก่อนหน้า (Previous Day)"
                    className="p-1.5 px-2 hover:bg-gray-200 active:bg-gray-300 text-gray-700 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Date Input */}
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setFilterByDate(true);
                    }}
                    className="bg-transparent text-xs font-semibold text-gray-800 px-2.5 py-1.5 focus:outline-none border-x border-gray-200 cursor-pointer"
                  />

                  {/* Next Day Button */}
                  <button
                    type="button"
                    onClick={handleNextDay}
                    title="วันถัดไป (Next Day)"
                    className="p-1.5 px-2 hover:bg-gray-200 active:bg-gray-300 text-gray-700 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Today Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(getTodayStr());
                    setFilterByDate(true);
                  }}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${
                    selectedDate === getTodayStr() && filterByDate
                      ? "bg-govblue-50 border-govblue-300 text-govblue-800 font-semibold shadow-2xs"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {t("วันนี้", "Today")}
                </button>
              </div>

              {/* View Mode Switcher: Cards vs Master Map */}
              <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0 bg-gray-100 p-1 rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    viewMode === "list"
                      ? "bg-white text-govblue-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <List size={15} />
                  <span>{t("รายการการ์ด", "Card List")}</span>
                  <span className="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-gray-200 text-gray-700 font-bold">
                    {displayedTasks.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    viewMode === "map"
                      ? "bg-govblue-800 text-white shadow-sm"
                      : "text-gray-700 hover:text-govblue-900"
                  }`}
                >
                  <Map size={15} />
                  <span>{t("แผนที่รวมจุดในงานต่างๆ", "Master Route Map")}</span>
                  <span
                    className={`ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      viewMode === "map" ? "bg-white/25 text-white" : "bg-govblue-100 text-govblue-800"
                    }`}
                  >
                    {displayedTasks.filter((t) => t.lat != null && t.lng != null).length}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Members View (Supervisor Only) */}
          {activeTab === "members" && isSup && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-govblue-50/50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-govblue-900">
                    {t("รายชื่อบุคลากรและเจ้าหน้าที่ในสังกัด", "Team Members & Subordinates")}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {t("รายชื่อทีมปฏิบัติงานสำรวจภาคสนามภายใต้การกำกับดูแล", "Field survey personnel under your direct supervision")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 bg-govblue-700 hover:bg-govblue-800 text-white text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-lg shadow-sm transition shrink-0"
                >
                  <Plus size={16} className="stroke-[2.5]" />
                  <span>{t("เพิ่มพนักงานเข้ากลุ่ม", "Add Member to Team")}</span>
                </button>
              </div>

              {(() => {
                const safeTeam = Array.isArray(myTeam) ? myTeam : [];
                if (safeTeam.length === 0) {
                  return (
                    <div className="p-10 sm:p-14 text-center">
                      <div className="w-14 h-14 mx-auto rounded-full bg-govblue-50 text-govblue-600 flex items-center justify-center mb-3">
                        <Users size={28} />
                      </div>
                      <h4 className="text-sm font-bold text-gray-800 mb-1">
                        {t("ยังไม่มีเจ้าหน้าที่ในสังกัด", "No subordinates in your team yet")}
                      </h4>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4 leading-relaxed">
                        {t(
                          "คุณสามารถเชิญเจ้าหน้าที่สำรวจภาคสนามเข้าร่วมทีมของคุณ เพื่อมอบหมายงานและติดตามผลงานได้",
                          "You can invite field survey personnel to your team to assign and monitor survey tasks."
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => setTeamModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-govblue-700 hover:bg-govblue-800 text-white shadow-sm transition"
                      >
                        <Plus size={15} className="stroke-[2.5]" />
                        <span>{t("เพิ่มพนักงานเข้ากลุ่ม", "Add Member to Team")}</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-gray-100">
                    {safeTeam.map((m) => {
                      if (!m) return null;
                      const userDetail = (Array.isArray(users) ? users : []).find(
                        (u) =>
                          u.public_id === m.subordinate_public_id ||
                          u.username === m.subordinate_username
                      );
                      const memberTasks = (Array.isArray(tasks) ? tasks : []).filter(
                        (t) =>
                          t &&
                          (t.assignee_public_id === m.subordinate_public_id ||
                            (userDetail && t.assignee_public_id === userDetail.public_id))
                      );
                      const activeTasks = memberTasks.filter((t) =>
                        ["pending", "accepted", "in_progress", "submitted"].includes(t.status)
                      );
                      const historyTasks = memberTasks.filter((t) =>
                        ["done", "cancelled"].includes(t.status)
                      );

                      return (
                        <div
                          key={m.id || m.subordinate_public_id}
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-3 hover:bg-gray-50/60 transition"
                        >
                          {/* Member Info */}
                          <div className="flex items-center gap-3 min-w-0">
                            {userDetail?.picture_url ? (
                              <img
                                src={userDetail.picture_url}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover ring-1 ring-gray-200 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-govblue-100 text-govblue-700 flex items-center justify-center text-sm font-bold shrink-0">
                                {(m.subordinate_name || m.subordinate_username || "U").charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900 truncate">
                                  {m.subordinate_name || m.subordinate_username}
                                </span>
                                {/* Fixed role badge (admin only controls permissions) */}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-govblue-50 text-govblue-800 border border-govblue-200 shrink-0">
                                  <Users size={11} className="text-govblue-600" />
                                  <span>{t("เจ้าหน้าที่สำรวจภาคสนาม", "Survey Officer")}</span>
                                </span>
                                {m.status === "pending" && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 shrink-0">
                                    ⏳ {t("รอการตอบรับ", "Pending Acceptance")}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                @{m.subordinate_username}
                              </div>
                            </div>
                          </div>

                          {/* 4 Actions Required by User */}
                          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-auto">
                            {/* 1. เพิ่มงาน */}
                            <Link
                              href={`/tasks/new?assignee=${encodeURIComponent(m.subordinate_public_id)}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-govblue-700 hover:bg-govblue-800 shadow-xs transition"
                              title={t("มอบหมายงานใหม่ให้พนักงานคนนี้", "Assign new task")}
                            >
                              <Plus size={14} className="stroke-[2.5]" />
                              <span>{t("เพิ่มงาน", "New Task")}</span>
                            </Link>

                            {/* 2. ดูงานที่กำลังทำอยู่ */}
                            <button
                              type="button"
                              onClick={() =>
                                setMemberTasksModal({
                                  isOpen: true,
                                  member: m,
                                  mode: "active",
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                              title={t("ดูงานที่กำลังทำอยู่", "View current tasks")}
                            >
                              <Briefcase size={13} className="text-amber-700" />
                              <span>{t("งานที่ทำอยู่", "Active Tasks")}</span>
                              {activeTasks.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-600 text-white">
                                  {activeTasks.length}
                                </span>
                              )}
                            </button>

                            {/* 3. ดูประวัติการทำงานของแต่ละคน */}
                            <button
                              type="button"
                              onClick={() =>
                                setMemberTasksModal({
                                  isOpen: true,
                                  member: m,
                                  mode: "history",
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition"
                              title={t("ดูประวัติการทำงาน", "View work history")}
                            >
                              <History size={13} className="text-gray-600" />
                              <span>{t("ประวัติงาน", "History")}</span>
                              {historyTasks.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-gray-600 text-white">
                                  {historyTasks.length}
                                </span>
                              )}
                            </button>

                            {/* 4. ลบออกจากทีมสังกัด */}
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveMember(
                                  m.subordinate_public_id,
                                  m.subordinate_name || m.subordinate_username || "",
                                  m.subordinate_username
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                              title={t("ลบออกจากทีมสังกัด", "Remove from team")}
                            >
                              <UserMinus size={13} className="text-rose-600" />
                              <span>{t("ลบออกจากทีม", "Remove")}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Main Tasks View: Either Master Map or Card List */}
          {activeTab !== "members" && (
            <>
              {viewMode === "map" ? (
                /* แผนที่รวมจุดในงานต่างๆ พร้อมระบบจัดเส้นทางและคำนวณระยะทาง */
                <TasksMasterMap
                  tasks={displayedTasks}
                  orderedIds={orderedTaskIds}
                  onReorder={setOrderedTaskIds}
                  onSelectTask={setSelectedTask}
                />
              ) : (
                /* Task Cards Grid (Clean, Fixed-size, Uniform & Modern) */
                <div className="space-y-4">
                  {displayedTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white text-center py-12 px-4 text-gray-500 shadow-xs flex flex-col items-center">
                      <ClipboardList size={36} className="mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-700">
                        {activeTab === "assigned_by_me"
                          ? t("ยังไม่มีงานที่คุณสั่ง — กดปุ่ม “+ สั่งงานใหม่” เพื่อเริ่มต้น", "No tasks assigned by you yet")
                          : t("ยังไม่มีงานที่ได้รับมอบหมายในวันที่เลือก", "No assigned tasks for this date")}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 mb-4">
                        งานที่สั่งจะได้รับการอัปเดตและแจ้งเตือนทันทีแบบอัตโนมัติ
                      </p>
                      <button
                        type="button"
                        onClick={handleReloadSampleTasks}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-govblue-700 hover:bg-govblue-800 text-white shadow-sm transition"
                      >
                        <RotateCcw size={14} />
                        <span>{t("โหลดข้อมูลตัวอย่างงานวันนี้ (14 รายการ)", "Load Today's Sample Tasks (14 Tasks)")}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {displayedTasks.map((task) => {
                        const statusDot =
                          task.status === "done"
                            ? "bg-emerald-500"
                            : task.status === "in_progress"
                            ? "bg-indigo-500"
                            : task.status === "accepted"
                            ? "bg-sky-500"
                            : task.status === "cancelled"
                            ? "bg-rose-500"
                            : "bg-amber-400";

                        return (
                          <div
                            key={task.public_id}
                            onClick={() => setSelectedTask(task)}
                            className="bg-white rounded-xl border border-gray-200 hover:border-govblue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between cursor-pointer group"
                          >
                            {/* Top: Code, Status & Due */}
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-mono font-bold text-govblue-800 bg-govblue-50 px-2 py-0.5 rounded border border-govblue-100">
                                    {task.code || "TASK"}
                                  </span>
                                  <span
                                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                                      STATUS_COLOR[task.status] || "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {STATUS_LABEL[task.status] || task.status || "—"}
                                  </span>
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {TYPE_LABEL[task.task_type] || task.task_type || "—"}
                                  </span>
                                </div>

                                {task.due_at && (
                                  <div className="text-xs text-gray-500 font-mono flex items-center gap-1 shrink-0">
                                    <Calendar size={12} className="text-gray-400" />
                                    <span>{(fmtDateTime(task.due_at) || "").split(" ")[0] || "-"}</span>
                                  </div>
                                )}
                              </div>

                              {/* Title: 1 line clamp */}
                              <h3 className="text-sm sm:text-base font-semibold text-gray-900 group-hover:text-govblue-700 transition line-clamp-1 leading-snug mt-1">
                                {task.title}
                              </h3>

                              {/* Description: 2 lines clamp with ... */}
                              <p className="text-xs text-gray-500 line-clamp-2 mt-1.5 leading-relaxed min-h-[2.5rem]">
                                {task.description || "— ไม่มีการระบุรายละเอียดงาน —"}
                              </p>

                              {/* Meta: Assigner, Assignee & Location */}
                              <div className="mt-3 pt-2.5 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs text-gray-600">
                                <div className="truncate">
                                  <span className="text-gray-400">สั่งโดย: </span>
                                  <span className="font-medium text-gray-800">{task.assigner_name || "หัวหน้างาน"}</span>
                                </div>
                                <div className="truncate">
                                  <span className="text-gray-400">ผู้รับ: </span>
                                  <span className="font-medium text-govblue-700">{task.assignee_name || "เจ้าหน้าที่"}</span>
                                </div>
                                {task.place_name && (
                                  <div className="col-span-2 flex items-center gap-1 text-xs text-gray-600 truncate mt-0.5">
                                    <MapPin size={12} className="text-rose-500 shrink-0" />
                                    <span className="truncate">{task.place_name}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Footer Action Bar */}
                            <div
                              className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Modern Dropdown Status Selector with Dot Indicator */}
                              <div className="relative inline-flex items-center">
                                <span className="text-xs text-gray-400 mr-1.5">สถานะ:</span>
                                <div className="relative flex items-center">
                                  <span className={`w-2 h-2 rounded-full absolute left-2.5 z-10 pointer-events-none ${statusDot}`} />
                                  <select
                                    value={task.status}
                                    onChange={(e) => {
                                      const nextSt = e.target.value as TaskStatus;
                                      if (nextSt === task.status) return;

                                      // ข้อยกเว้น: ยกเลิกงานได้เสมอทุกขั้นตอน พร้อมกล่องยืนยัน
                                      if (nextSt === "cancelled") {
                                        setConfirmDialog({
                                          isOpen: true,
                                          title: "ยืนยันการยกเลิกงานสำรวจ",
                                          message: (
                                            <p className="text-gray-700">
                                              ท่านต้องการเปลี่ยนสถานะงาน <strong className="text-gray-900 font-semibold">"{task.title}"</strong> เป็น <span className="text-rose-600 font-semibold">"ยกเลิก"</span> ใช่หรือไม่?
                                            </p>
                                          ),
                                          tone: "warning",
                                          confirmLabel: "ยืนยันยกเลิกงาน",
                                          cancelLabel: "ย้อนกลับ",
                                          onCancel: closeConfirmDialog,
                                          onConfirm: () => {
                                            setStatus(task, "cancelled");
                                            closeConfirmDialog();
                                          },
                                        });
                                        return;
                                      }

                                      // กรณีกู้คืนสถานะจาก cancelled กลับมา
                                      if (task.status === "cancelled") {
                                        setStatus(task, nextSt);
                                        return;
                                      }

                                      const curIdx = getStepIndex(task.status);
                                      const targetIdx = getStepIndex(nextSt);

                                      // ตรวจสอบสิทธิ์: ผู้รับมอบหมายเท่านั้นที่เปลี่ยนสถานะการลงพื้นที่ได้
                                      const isTaskAssignee = Boolean(
                                        me && (
                                          task.assignee_public_id === me.public_id ||
                                          task.assignee_name === me.display_name
                                        )
                                      );

                                      if (!isTaskAssignee && (nextSt === "accepted" || nextSt === "in_progress" || nextSt === "submitted")) {
                                        setConfirmDialog({
                                          isOpen: true,
                                          title: "เฉพาะผู้รับมอบหมายงานเท่านั้นที่มีสิทธิ์ดำเนินการ",
                                          message: (
                                            <div className="space-y-2 text-left">
                                              <p className="text-gray-700 text-center">
                                                งานนี้มอบหมายให้คุณ <strong className="text-gray-900 font-semibold">"{task.assignee_name || "เจ้าหน้าที่สำรวจ"}"</strong> เป็นผู้รับผิดชอบ
                                              </p>
                                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                                                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                                                <span>
                                                  หัวหน้างานไม่มีสิทธิ์กดรับงานหรือเปลี่ยนสถานะการลงพื้นที่แทนลูกน้อง เฉพาะเจ้าของงานที่เป็นผู้สำรวจจริงเท่านั้นที่สามารถดำเนินการได้
                                                </span>
                                              </div>
                                            </div>
                                          ),
                                          tone: "warning",
                                          confirmLabel: "รับทราบ",
                                          cancelLabel: "ปิด",
                                          onCancel: closeConfirmDialog,
                                          onConfirm: closeConfirmDialog,
                                        });
                                        return;
                                      }

                                      // ตรวจสอบการกระโดดข้ามขั้นตอน (ห้ามข้าม)
                                      if (targetIdx > curIdx + 1) {
                                        const nextStep = PIPELINE_STEPS[curIdx + 1];
                                        setConfirmDialog({
                                          isOpen: true,
                                          title: "ไม่สามารถข้ามขั้นตอนได้",
                                          message: (
                                            <div className="space-y-2 text-left">
                                              <p className="text-gray-700 text-center">
                                                ระบบกำหนดให้ดำเนินงานตามลำดับขั้นตอน ค่อยๆ ไปทีละขั้นตอน ไม่สามารถกดข้ามขั้นตอนได้
                                              </p>
                                              {nextStep && (
                                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                                                  <AlertCircle size={18} className="text-amber-600 shrink-0" />
                                                  <span>
                                                    ขั้นตอนถัดไปที่ต้องทำคือ: <strong>ขั้นตอนที่ {curIdx + 2} "{nextStep.label}"</strong> ({nextStep.sub})
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          ),
                                          tone: "warning",
                                          confirmLabel: "รับทราบ",
                                          cancelLabel: "ปิด",
                                          onCancel: closeConfirmDialog,
                                          onConfirm: closeConfirmDialog,
                                        });
                                        return;
                                      }

                                      // ถ้าถึงขั้นตอนส่งงาน
                                      if (nextSt === "submitted") {
                                        openSubmissionModal(task);
                                        return;
                                      }

                                      // ถ้าถึงขั้นตอนอนุมัติเสร็จสิ้น
                                      if (nextSt === "done") {
                                        if (isSup) {
                                          openReviewModal(task);
                                        } else {
                                          setConfirmDialog({
                                            isOpen: true,
                                            title: "อยู่ระหว่างรอหัวหน้างานตรวจสอบ",
                                            message: "พนักงานสำรวจไม่สามารถอนุมัติงานให้เสร็จสิ้นได้ด้วยตนเอง (ต้องได้รับการตรวจและอนุมัติจากหัวหน้างาน)",
                                            tone: "primary",
                                            confirmLabel: "รับทราบ",
                                            cancelLabel: "ปิด",
                                            onCancel: closeConfirmDialog,
                                            onConfirm: closeConfirmDialog,
                                          });
                                        }
                                        return;
                                      }

                                      setStatus(task, nextSt);
                                    }}
                                    className={`text-xs font-semibold pl-6 pr-7 py-1 rounded-lg border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-govblue-500/20 transition ${
                                      task.status === "done"
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70"
                                        : task.status === "submitted"
                                        ? "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100/70"
                                        : task.status === "revision_requested"
                                        ? "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100/70"
                                        : task.status === "in_progress"
                                        ? "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100/70"
                                        : task.status === "accepted"
                                        ? "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100/70"
                                        : task.status === "cancelled"
                                        ? "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100/70"
                                        : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70"
                                    }`}
                                  >
                                    <option value="pending">รอรับงาน</option>
                                    <option value="accepted">รับงานแล้ว</option>
                                    <option value="in_progress">กำลังปฏิบัติงาน</option>
                                    <option value="submitted">ส่งตรวจแล้ว</option>
                                    <option value="revision_requested">ส่งกลับแก้ไข</option>
                                    <option value="done">เสร็จสิ้น</option>
                                    <option value="cancelled">ยกเลิก</option>
                                  </select>
                                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 text-current" />
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1.5">
                                {isSup && task.status === "submitted" && (
                                  <button
                                    type="button"
                                    onClick={() => openReviewModal(task)}
                                    className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1.5 rounded-lg transition shadow-2xs"
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>ตรวจงาน</span>
                                  </button>
                                )}
                                {!isSup && (task.status === "accepted" || task.status === "in_progress" || task.status === "revision_requested") && (
                                  <button
                                    type="button"
                                    onClick={() => openSubmissionModal(task)}
                                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition shadow-2xs"
                                  >
                                    <Plus size={13} />
                                    <span>ส่งผลงาน</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSelectedTask(task)}
                                  className="text-xs font-semibold text-govblue-700 hover:text-govblue-900 flex items-center gap-1 bg-govblue-50 hover:bg-govblue-100 px-3 py-1.5 rounded-lg transition"
                                >
                                  <span>ดูรายละเอียด</span>
                                  <ArrowRight size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Detail Modal (หน้าต่างดูรายละเอียดงานฉบับเต็ม พร้อม Pipeline Stepper & แผนที่) */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header: Deep Govblue Theme */}
            <div className="px-6 py-5 bg-gradient-to-r from-govblue-800 via-govblue-700 to-govblue-800 text-white flex items-start justify-between gap-4 shrink-0 shadow-sm border-b border-govblue-600">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-mono font-bold bg-white/15 text-govgold-400 border border-white/20 px-2.5 py-0.5 rounded shadow-xs">
                    {selectedTask.code || "TASK"}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      STATUS_COLOR[selectedTask.status] || "bg-white/20 text-white"
                    }`}
                  >
                    {STATUS_LABEL[selectedTask.status] || selectedTask.status || "—"}
                  </span>
                  <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-blue-100 border border-white/10">
                    {TYPE_LABEL[selectedTask.task_type] || selectedTask.task_type || "—"}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white leading-snug break-words">
                  {selectedTask.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseTaskModal}
                className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/15 transition shrink-0"
                title="ปิดหน้าต่าง"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-gray-800">
              {/* Modern Delivery Tracker Pipeline Stepper (รองรับมือถือแบบเรียงสถานะละ 1 แถว และ Desktop แบบ Tracker แนวนอน) */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-sm space-y-3 sm:space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-govblue-50 text-govblue-800 flex items-center justify-center font-bold text-xs shrink-0">
                      <Activity size={15} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-govblue-950 uppercase tracking-wide truncate">
                        ขั้นตอนการดำเนินงาน (Workflow Pipeline)
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-gray-500 truncate">
                        ดำเนินงานตามลำดับขั้นตอน (ทีละขั้นตอน ไม่กดข้าม)
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {selectedTask.status === "cancelled" ? (
                      <span className="text-[11px] sm:text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 whitespace-nowrap">
                        <X size={12} className="stroke-[3]" />
                        ยกเลิกงานนี้แล้ว
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-500 hidden sm:inline">สถานะ:</span>
                        <span className={`text-[11px] sm:text-xs font-bold px-2.5 py-0.5 sm:py-1 rounded-full whitespace-nowrap ${STATUS_COLOR[selectedTask.status] || "bg-gray-100 text-gray-800"}`}>
                          {STATUS_LABEL[selectedTask.status] || selectedTask.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {(() => {
                  const curIdx = getStepIndex(selectedTask.status);
                  const isTaskAssignee = Boolean(
                    me && (
                      selectedTask.assignee_public_id === me.public_id ||
                      selectedTask.assignee_name === me.display_name
                    )
                  );
                  return (
                    <>
                      {/* Mobile View: เรียง Status ละ 1 แถว สบายตา ไม่เบียด Text กระชับ (ตามคำขอของผู้ใช้) */}
                      <div className="block sm:hidden space-y-2">
                        {PIPELINE_STEPS.map((step, idx) => {
                          const StepIcon = step.icon;
                          const isCurrent = curIdx === idx && selectedTask.status !== "cancelled";
                          const isPassed = curIdx > idx && selectedTask.status !== "cancelled";
                          const isNextImmediate = curIdx + 1 === idx && selectedTask.status !== "cancelled";
                          const isRevision = isCurrent && selectedTask.status === "revision_requested";

                          return (
                            <div
                              key={step.status}
                              onClick={() => {
                                if (isNextImmediate) handleAdvancePipeline(idx);
                              }}
                              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                isRevision
                                  ? "bg-orange-50/90 border-orange-300 ring-2 ring-orange-200"
                                  : isCurrent
                                  ? "bg-govblue-50/80 border-govblue-300 shadow-xs ring-1 ring-govblue-200"
                                  : isPassed
                                  ? "bg-gray-50/70 border-gray-200 text-gray-700"
                                  : isNextImmediate
                                  ? "bg-white border-2 border-dashed border-govblue-500 shadow-xs cursor-pointer active:bg-govblue-50/50"
                                  : "bg-gray-50/40 border-gray-200 opacity-60"
                              }`}
                            >
                              {/* Left: Node Circle + Label */}
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition ${
                                    isRevision
                                      ? "bg-orange-500 text-white shadow-xs animate-pulse"
                                      : isPassed
                                      ? "bg-govblue-800 text-white"
                                      : isCurrent
                                      ? "bg-govblue-900 text-govgold-400 ring-2 ring-govblue-300 font-bold shadow-xs"
                                      : isNextImmediate
                                      ? "bg-white text-govblue-700 border-2 border-dashed border-govblue-600"
                                      : "bg-gray-100 text-gray-400 border border-gray-200"
                                  }`}
                                >
                                  {isRevision ? (
                                    <AlertCircle size={14} className="stroke-[2.5]" />
                                  ) : isPassed ? (
                                    <Check size={14} className="stroke-[3] text-govgold-400" />
                                  ) : isCurrent ? (
                                    <StepIcon size={14} className="stroke-[2.5]" />
                                  ) : isNextImmediate ? (
                                    <ArrowRight size={13} className="text-govblue-700 stroke-[2.5]" />
                                  ) : (
                                    <Lock size={11} className="text-gray-400" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <span
                                    className={`text-xs leading-snug block truncate ${
                                      isCurrent
                                        ? "font-bold text-govblue-950"
                                        : isPassed
                                        ? "font-semibold text-gray-800"
                                        : isNextImmediate
                                        ? "font-semibold text-govblue-800"
                                        : "font-medium text-gray-500"
                                    }`}
                                  >
                                    {idx + 1}. {step.label}
                                  </span>
                                </div>
                              </div>

                              {/* Right: Action or Status Badge */}
                              <div className="shrink-0 pl-2">
                                {isRevision ? (
                                  <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                                    ส่งกลับแก้ไข
                                  </span>
                                ) : isPassed ? (
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md whitespace-nowrap flex items-center gap-1">
                                    <Check size={10} className="stroke-[3]" /> เสร็จสิ้น
                                  </span>
                                ) : isCurrent ? (
                                  <span className="text-[10px] font-bold text-govblue-800 bg-govblue-100 border border-govblue-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                                    {idx === 4 ? "เสร็จสมบูรณ์" : "กำลังทำ"}
                                  </span>
                                ) : isNextImmediate ? (
                                  !isTaskAssignee && idx < 3 ? (
                                    <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md whitespace-nowrap flex items-center gap-1 font-medium">
                                      <Clock size={10} className="text-amber-600" /> รอผู้รับงาน
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAdvancePipeline(idx);
                                      }}
                                      className="text-[11px] font-bold text-white bg-govblue-800 hover:bg-govblue-900 active:scale-95 px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1 whitespace-nowrap transition"
                                    >
                                      <span>ทำขั้นตอนนี้</span>
                                      <ArrowRight size={11} />
                                    </button>
                                  )
                                ) : (
                                  <span className="text-[10px] text-gray-400 whitespace-nowrap flex items-center gap-1 px-1">
                                    <Lock size={9} /> รอดำเนินการ
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop View: Horizontal Progress Tracker (Image 2 style) */}
                      <div className="hidden sm:block relative pt-2 pb-2">
                        {/* Base connecting line across 5 columns (starts at center of col 0, ends at center of col 4) */}
                        <div className="absolute top-[30px] left-[10%] right-[10%] h-2 bg-gray-200 rounded-full -translate-y-1/2 z-0" />

                        {/* Filled active progress bar */}
                        {selectedTask.status !== "cancelled" && curIdx >= 0 && (
                          <div
                            className="absolute top-[30px] left-[10%] h-2 bg-gradient-to-r from-govblue-600 via-govblue-700 to-govblue-800 rounded-full -translate-y-1/2 z-0 transition-all duration-500"
                            style={{ width: `${Math.max(0, Math.min(curIdx, 4)) * 20}%` }}
                          />
                        )}

                        {/* 5 Step Nodes Grid */}
                        <div className="grid grid-cols-5 relative z-10">
                          {PIPELINE_STEPS.map((step, idx) => {
                            const StepIcon = step.icon;
                            const isCurrent = curIdx === idx && selectedTask.status !== "cancelled";
                            const isPassed = curIdx > idx && selectedTask.status !== "cancelled";
                            const isNextImmediate = curIdx + 1 === idx && selectedTask.status !== "cancelled";
                            const isRevision = isCurrent && selectedTask.status === "revision_requested";

                            return (
                              <button
                                key={step.status}
                                type="button"
                                onClick={() => handleAdvancePipeline(idx)}
                                className={`flex flex-col items-center text-center transition-all group focus:outline-none ${
                                  isNextImmediate
                                    ? "cursor-pointer"
                                    : isCurrent
                                    ? "cursor-default"
                                    : isPassed
                                    ? "cursor-pointer"
                                    : "cursor-not-allowed opacity-70"
                                }`}
                                title={
                                  isPassed
                                    ? `ขั้นตอนที่ ${idx + 1}: ${step.label} (เสร็จแล้ว)`
                                    : isCurrent
                                    ? `ขั้นตอนปัจจุบัน: ${step.label}`
                                    : isNextImmediate
                                    ? `คลิกเพื่อดำเนินการขั้นตอนถัดไป: ${step.label}`
                                    : `ขั้นตอนที่ ${idx + 1}: ${step.label} (ต้องทำตามลำดับ)`
                                }
                              >
                                {/* Circular Node */}
                                <div
                                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                                    isRevision
                                      ? "bg-orange-500 text-white ring-4 ring-orange-200 shadow-md animate-pulse"
                                      : isPassed
                                      ? "bg-govblue-800 text-white shadow-sm group-hover:scale-105"
                                      : isCurrent
                                      ? "bg-govblue-900 text-govgold-400 ring-4 ring-govblue-200 shadow-lg scale-110 font-bold"
                                      : isNextImmediate
                                      ? "bg-white text-govblue-700 border-2 border-dashed border-govblue-600 ring-2 ring-govblue-100 hover:ring-govblue-300 hover:bg-govblue-50/60 shadow-sm group-hover:scale-105"
                                      : "bg-white text-gray-300 border-2 border-gray-300 shadow-2xs"
                                  }`}
                                >
                                  {isRevision ? (
                                    <AlertCircle size={16} className="sm:w-5 sm:h-5 stroke-[2.5]" />
                                  ) : isPassed ? (
                                    <Check size={16} className="sm:w-5 sm:h-5 stroke-[3] text-govgold-400" />
                                  ) : isCurrent ? (
                                    <StepIcon size={16} className="sm:w-5 sm:h-5 stroke-[2.5]" />
                                  ) : isNextImmediate ? (
                                    <ArrowRight size={15} className="sm:w-4 sm:h-4 text-govblue-700 stroke-[2.5] group-hover:translate-x-0.5 transition" />
                                  ) : (
                                    <Lock size={13} className="sm:w-3.5 sm:h-3.5 text-gray-400" />
                                  )}
                                </div>

                                {/* Step Content below Node */}
                                <div className="mt-2 flex flex-col items-center max-w-[95px] sm:max-w-[110px]">
                                  <div className="flex items-center justify-center gap-1">
                                    <StepIcon
                                      size={12}
                                      className={`hidden sm:inline shrink-0 ${
                                        isCurrent
                                          ? "text-govblue-900 font-bold"
                                          : isPassed
                                          ? "text-govblue-700"
                                          : isNextImmediate
                                          ? "text-govblue-600"
                                          : "text-gray-400"
                                      }`}
                                    />
                                    <span
                                      className={`text-[10px] sm:text-xs leading-tight ${
                                        isCurrent
                                          ? "font-bold text-govblue-950"
                                          : isPassed
                                          ? "font-semibold text-gray-800"
                                          : isNextImmediate
                                          ? "font-semibold text-govblue-700 underline decoration-govblue-300 decoration-1 underline-offset-2"
                                          : "font-medium text-gray-400"
                                      }`}
                                    >
                                      {step.label}
                                    </span>
                                  </div>

                                  <span
                                    className={`text-[8px] sm:text-[10px] mt-0.5 leading-tight hidden sm:block ${
                                      isCurrent
                                        ? "text-govblue-700 font-medium"
                                        : isPassed
                                        ? "text-gray-500"
                                        : "text-gray-400"
                                    }`}
                                  >
                                    {step.sub}
                                  </span>

                                  <div className="mt-1">
                                    {isRevision ? (
                                      <span className="text-[8px] sm:text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                        ส่งกลับแก้ไข
                                      </span>
                                    ) : isPassed ? (
                                      <span className="text-[8px] sm:text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5">
                                        <Check size={9} className="stroke-[3]" /> เสร็จสิ้น
                                      </span>
                                    ) : isCurrent ? (
                                      <span className="text-[8px] sm:text-[9px] font-bold text-govblue-800 bg-govblue-100 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap ring-1 ring-govblue-200">
                                        {idx === 4 ? "สมบูรณ์" : "กำลังทำ"}
                                      </span>
                                    ) : isNextImmediate ? (
                                      !isTaskAssignee && idx < 3 ? (
                                        <span className="text-[8px] sm:text-[9px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap border border-amber-200">
                                          รอผู้รับงาน
                                        </span>
                                      ) : (
                                        <span className="text-[8px] sm:text-[9px] font-bold text-govblue-700 bg-govblue-50 group-hover:bg-govblue-100 px-1.5 py-0.5 rounded-full whitespace-nowrap border border-govblue-200 transition">
                                          ถัดไป ➔
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-[8px] sm:text-[9px] text-gray-400 whitespace-nowrap flex items-center gap-0.5">
                                        <Lock size={8} /> รอดำเนินการ
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Contextual Action Box (กล่องแนะนำและดำเนินการขั้นตอนถัดไป + ปุ่มยกเลิกงาน) */}
                {(() => {
                  const curIdx = getStepIndex(selectedTask.status);
                  const isTaskAssignee = Boolean(
                    me && (
                      selectedTask.assignee_public_id === me.public_id ||
                      selectedTask.assignee_name === me.display_name
                    )
                  );
                  return (
                    <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50/70 p-2.5 sm:p-3 rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          selectedTask.status === "cancelled"
                            ? "bg-rose-100 text-rose-700"
                            : selectedTask.status === "done"
                            ? "bg-emerald-100 text-emerald-700"
                            : selectedTask.status === "revision_requested"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-govblue-100 text-govblue-800"
                        }`}>
                          {selectedTask.status === "cancelled" ? (
                            <X size={15} />
                          ) : selectedTask.status === "done" ? (
                            <Award size={15} />
                          ) : selectedTask.status === "revision_requested" ? (
                            <AlertCircle size={15} />
                          ) : (
                            <ArrowRight size={15} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {selectedTask.status === "pending" && (isTaskAssignee ? "ขั้นตอนถัดไป: ยืนยันการรับงาน" : "อยู่ระหว่างรอผู้รับมอบหมายยืนยันรับงาน")}
                            {selectedTask.status === "accepted" && (isTaskAssignee ? "ขั้นตอนถัดไป: เริ่มลงพื้นที่สำรวจรังวัด" : "อยู่ระหว่างรอผู้รับมอบหมายเริ่มลงพื้นที่")}
                            {(selectedTask.status === "in_progress" || selectedTask.status === "revision_requested") && (isTaskAssignee ? "ขั้นตอนถัดไป: กรอกข้อมูลและส่งภาพผลงาน" : "เจ้าหน้าที่กำลังลงพื้นที่ปฏิบัติงานสำรวจ")}
                            {selectedTask.status === "submitted" && (isSup ? "ขั้นตอนถัดไป: ตรวจสอบและอนุมัติผลงาน" : "รอหัวหน้างานตรวจสอบและอนุมัติ")}
                            {selectedTask.status === "done" && "ภารกิจสำรวจเสร็จสมบูรณ์เรียบร้อย"}
                            {selectedTask.status === "cancelled" && "ภารกิจนี้ถูกยกเลิกแล้ว"}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate hidden sm:block">
                            {selectedTask.status === "pending" && (isTaskAssignee ? "เมื่อยืนยันรับงาน สถานะจะเปลี่ยนเป็น 'รับงานแล้ว'" : `งานนี้มอบหมายให้คุณ ${selectedTask.assignee_name || "เจ้าหน้าที่"} — เฉพาะผู้รับมอบหมายเท่านั้นที่สามารถกดรับงานได้`)}
                            {selectedTask.status === "accepted" && (isTaskAssignee ? "กดเริ่มงานเมื่อทีมงานพร้อมลงพื้นที่สำรวจ" : `คุณ ${selectedTask.assignee_name || "เจ้าหน้าที่"} ยืนยันรับงานแล้ว อยู่ระหว่างรอเริ่มลงพื้นที่`)}
                            {(selectedTask.status === "in_progress" || selectedTask.status === "revision_requested") && (isTaskAssignee ? "ส่งพิกัด แผนที่ และภาพถ่ายผลงานเพื่อขออนุมัติ" : `รอคุณ ${selectedTask.assignee_name || "เจ้าหน้าที่"} บันทึกข้อมูลและส่งภาพถ่ายผลงาน`)}
                            {selectedTask.status === "submitted" && (isSup ? "ตรวจสอบความถูกต้องของข้อมูลก่อนอนุมัติเข้าระบบ" : "ส่งผลงานเข้าระบบแล้ว รอการตรวจสอบ")}
                            {selectedTask.status === "done" && "ผ่านการตรวจสอบและบันทึกเข้าระบบเรียบร้อยแล้ว"}
                            {selectedTask.status === "cancelled" && "ท่านสามารถกู้คืนสถานะเพื่อกลับมาดำเนินงานต่อได้"}
                          </p>
                        </div>
                      </div>

                      {/* Buttons: Next Step Action & Cancel Button */}
                      <div className="flex items-center gap-2 justify-end shrink-0">
                        {/* Primary Next Action Button */}
                        {selectedTask.status !== "cancelled" && curIdx < 4 && (
                          <>
                            {/* สำหรับขั้นตอนที่ 0, 1, 2: หากไม่ใช่ผู้รับมอบหมายงาน ให้แสดงสถานะรอผู้รับงาน */}
                            {curIdx < 3 && !isTaskAssignee && (
                              <div className="px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap">
                                <Clock size={13} className="text-amber-600" />
                                <span>
                                  {curIdx === 0 && `รอ ${selectedTask.assignee_name || "เจ้าหน้าที่"} รับงาน`}
                                  {curIdx === 1 && `รอ ${selectedTask.assignee_name || "เจ้าหน้าที่"} ลงพื้นที่`}
                                  {curIdx === 2 && `รอ ${selectedTask.assignee_name || "เจ้าหน้าที่"} ส่งงาน`}
                                </span>
                              </div>
                            )}

                            {/* ถ้าเป็นผู้รับมอบหมายงาน หรือขั้นตอนส่งตรวจ/อนุมัติ */}
                            {(curIdx >= 3 || isTaskAssignee) && (
                              <button
                                type="button"
                                onClick={() => handleAdvancePipeline(curIdx + 1)}
                                className="px-3 py-1.5 bg-govblue-800 hover:bg-govblue-900 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 whitespace-nowrap"
                              >
                                {curIdx === 0 && (
                                  <>
                                    <CheckCircle2 size={13} className="text-govgold-400" />
                                    <span>ยืนยันรับงาน</span>
                                  </>
                                )}
                                {curIdx === 1 && (
                                  <>
                                    <MapPin size={13} className="text-govgold-400" />
                                    <span>เริ่มลงพื้นที่</span>
                                  </>
                                )}
                                {curIdx === 2 && (
                                  <>
                                    <FileCheck2 size={13} className="text-govgold-400" />
                                    <span>ส่งผลงานให้ตรวจ</span>
                                  </>
                                )}
                                {curIdx === 3 && isSup && (
                                  <>
                                    <Award size={13} className="text-govgold-400" />
                                    <span>ตรวจและอนุมัติ</span>
                                  </>
                                )}
                                {curIdx === 3 && !isSup && (
                                  <>
                                    <Clock size={13} />
                                    <span>รอหัวหน้าอนุมัติ</span>
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        )}

                        {/* ยกเว้น ยกเลิก (Cancel Exception Button) */}
                        {selectedTask.status !== "cancelled" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: "ยืนยันการยกเลิกงานสำรวจ",
                                message: (
                                  <div className="text-left space-y-2">
                                    <p className="text-center text-gray-700">
                                      ท่านต้องการเปลี่ยนสถานะงาน <strong className="text-gray-900 font-semibold">"{selectedTask.title}"</strong> เป็น <span className="text-rose-600 font-semibold">"ยกเลิก"</span> ใช่หรือไม่?
                                    </p>
                                    <p className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                      งานที่ถูกยกเลิกจะไม่ปรากฏในรายการปฏิบัติงานประจำวัน แต่ท่านสามารถกู้คืนสถานะกลับมาได้ในภายหลัง
                                    </p>
                                  </div>
                                ),
                                tone: "warning",
                                confirmLabel: "ยืนยันยกเลิกงาน",
                                cancelLabel: "ย้อนกลับ",
                                onCancel: closeConfirmDialog,
                                onConfirm: () => {
                                  setStatus(selectedTask, "cancelled");
                                  setSelectedTask({ ...selectedTask, status: "cancelled" });
                                  closeConfirmDialog();
                                },
                              });
                            }}
                            className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition font-medium flex items-center gap-1"
                          >
                            <X size={13} />
                            <span>ยกเลิกงานนี้</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setStatus(selectedTask, "pending");
                              setSelectedTask({ ...selectedTask, status: "pending" });
                            }}
                            className="px-3 py-1.5 text-xs text-govblue-800 hover:bg-govblue-50 border border-govblue-300 rounded-lg transition font-semibold flex items-center gap-1"
                          >
                            <RotateCcw size={13} />
                            <span>กู้คืนสถานะกลับมา</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Supervisor Feedback Banner (เมื่อถูกส่งกลับให้แก้ไข) */}
              {selectedTask.supervisor_feedback && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-1 text-xs text-orange-900 animate-in fade-in">
                  <div className="font-bold flex items-center gap-1.5 text-orange-800">
                    <AlertCircle size={16} className="text-orange-600" />
                    <span>ข้อเสนอแนะให้แก้ไขจากหัวหน้างาน:</span>
                  </div>
                  <p className="leading-relaxed pl-5 whitespace-pre-wrap">
                    {selectedTask.supervisor_feedback}
                  </p>
                </div>
              )}

              {/* Status Note when Submitted */}
              {selectedTask.status === "submitted" && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-1 text-xs text-purple-900 animate-in fade-in">
                  <div className="font-bold flex items-center gap-1.5 text-purple-800">
                    <Clock size={16} className="text-purple-600" />
                    <span>งานนี้ส่งผลงานแล้ว — อยู่ระหว่างรอหัวหน้างานตรวจสอบและอนุมัติ</span>
                  </div>
                  <p className="leading-relaxed pl-5 text-purple-700">
                    เมื่อหัวหน้างานอนุมัติ ข้อมูลทรัพย์สินจะถูกบันทึกเข้าสู่ระบบจริงทันที
                  </p>
                </div>
              )}

              {/* Submitted Data Preview (ถ้ามี) */}
              {/* Submitted Data Preview (ถ้ามี) */}
              {(() => {
                if (!selectedTask.submission_data) return null;
                let sub: any = null;
                if (typeof selectedTask.submission_data === "string") {
                  try {
                    sub = JSON.parse(selectedTask.submission_data);
                  } catch {
                    sub = null;
                  }
                } else {
                  sub = selectedTask.submission_data;
                }
                if (!sub) return null;

                const photos: any[] = Array.isArray(sub.photos) ? sub.photos : [];
                const polygon: LatLngPoint[] = Array.isArray(sub.polygon) ? sub.polygon : [];
                const items: any[] = Array.isArray(sub.items)
                  ? sub.items
                  : Array.isArray(sub.lands)
                  ? sub.lands
                  : Array.isArray(sub.buildings)
                  ? sub.buildings
                  : [];

                return (
                  <div className="p-4 bg-slate-50 border border-govblue-200/80 rounded-2xl space-y-3 text-xs shadow-2xs">
                    <div className="font-bold text-govblue-900 flex items-center justify-between border-b border-govblue-100 pb-2">
                      <div className="flex items-center gap-1.5">
                        <FileCheck2 size={16} className="text-emerald-600" />
                        <span className="text-sm">ผลงานและข้อมูลที่บันทึกส่งมอบ (Submission Data)</span>
                      </div>
                      {selectedTask.target_type && (
                        <span className="text-[11px] font-semibold text-govblue-700 bg-govblue-100/60 px-2.5 py-0.5 rounded-full">
                          {selectedTask.target_type === "land" ? "ข้อมูลแปลงที่ดิน" : "ข้อมูลสิ่งปลูกสร้าง"}
                        </span>
                      )}
                    </div>

                    {sub.summary && (
                      <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <span className="text-gray-400 block text-[11px] mb-0.5">หมายเหตุสรุปจากผู้ปฏิบัติงาน:</span>
                        <p className="text-gray-800 italic font-medium">"{sub.summary}"</p>
                      </div>
                    )}

                    {/* Calculated Area Badge */}
                    {(sub.area_thai || sub.area_sqm) && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📐</span>
                          <div>
                            <span className="text-[11px] text-emerald-800 font-semibold block">
                              ขนาดพื้นที่สำรวจ (คำนวณจากแผนที่ดาวเทียม):
                            </span>
                            <span className="text-emerald-950 font-extrabold text-xs sm:text-sm">
                              {sub.area_thai || `${sub.rai || 0} ไร่ ${sub.ngan || 0} งาน ${sub.wa || 0} ตร.ว.`}
                              {sub.area_sqm ? ` (${Number(sub.area_sqm).toLocaleString()} ตร.ม.)` : ""}
                            </span>
                          </div>
                        </div>
                        {polygon.length > 0 && (
                          <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                            {polygon.length} จุดแนวเขต
                          </span>
                        )}
                      </div>
                    )}

                    {/* Photos Gallery */}
                    {photos.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-gray-700 flex items-center gap-1">
                          <Camera size={13} className="text-govblue-600" /> ภาพถ่ายสำรวจภาคสนาม ({photos.length} ภาพ)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {photos.map((p: any, pIdx: number) => (
                            <div
                              key={p.id || pIdx}
                              onClick={() =>
                                setPreviewPhoto({
                                  url: p.url,
                                  name: p.name || `ภาพที่ ${pIdx + 1}`,
                                  caption: p.caption,
                                })
                              }
                              className="group relative bg-black rounded-xl overflow-hidden aspect-video border border-gray-200 cursor-pointer shadow-2xs hover:border-govblue-500 transition"
                            >
                              <img
                                src={p.url}
                                alt={p.name || "Survey Photo"}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn size={16} className="text-white" />
                              </div>
                              {p.caption && (
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[10px] text-white truncate">
                                  {p.caption}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Items table summary */}
                    {items.length > 0 && (
                      <div className="text-[11px] text-gray-500 font-medium">
                        รวมข้อมูลรายการทรัพย์สิน: <strong>{items.length} รายการ</strong>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Full Description Section */}
              <div>
                <h4 className="text-xs font-bold text-govblue-900 mb-1.5 uppercase tracking-wide">
                  รายละเอียดงาน (Description)
                </h4>
                <div className="bg-slate-50/70 p-4 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selectedTask.description || "— ไม่มีการระบุรายละเอียดงาน —"}
                </div>
              </div>

              {/* Meta Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5 text-[11px]">ผู้สั่งงาน</span>
                  <span className="font-semibold text-gray-800">{selectedTask.assigner_name || "หัวหน้างาน"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5 text-[11px]">ผู้รับมอบหมาย</span>
                  <span className="font-semibold text-govblue-700">{selectedTask.assignee_name || "เจ้าหน้าที่สำรวจ"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5 text-[11px]">กำหนดเสร็จ</span>
                  <span className="font-medium text-gray-700">{fmtDateTime(selectedTask.due_at)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5 text-[11px]">วันที่สั่งงาน</span>
                  <span className="font-medium text-gray-700">{fmtDateTime(selectedTask.created_at)}</span>
                </div>
              </div>

              {/* Location & Map Section (สไตล์เดียวกับหน้าคำนวณภาษี LandDetailModal พร้อมปุ่มนำทาง GPS) */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
                  <MapPin size={15} className="text-rose-500" /> พิกัดและแผนที่ตำแหน่งที่ดิน (Location Map)
                </h4>

                {selectedTask.place_name && (
                  <div className="text-xs text-gray-700 mb-2.5 font-medium bg-rose-50/70 border border-rose-200 px-3 py-2 rounded-xl flex items-center gap-2">
                    <MapPin size={14} className="text-rose-500 shrink-0" />
                    <span>{selectedTask.place_name}</span>
                  </div>
                )}

                {selectedTask.lat != null && selectedTask.lng != null ? (
                  <div className="space-y-2">
                    <div className="h-52 sm:h-60 rounded-xl overflow-hidden border border-gray-300 shadow-2xs">
                      {(() => {
                        let parsedPolygon: LatLngPoint[] = [];
                        if (selectedTask.submission_data) {
                          try {
                            const sub =
                              typeof selectedTask.submission_data === "string"
                                ? JSON.parse(selectedTask.submission_data)
                                : selectedTask.submission_data;
                            if (Array.isArray(sub?.polygon) && sub.polygon.length >= 3) {
                              parsedPolygon = sub.polygon;
                            }
                          } catch {
                            parsedPolygon = [];
                          }
                        }

                        if (parsedPolygon.length >= 3) {
                          return (
                            <SurveyPolygonMap
                              initialPoints={parsedPolygon}
                              height="240px"
                              readOnly={true}
                            />
                          );
                        }

                        return (
                          <MapPicker
                            lat={selectedTask.lat}
                            lng={selectedTask.lng}
                            height="240px"
                            showInputs={false}
                            readOnly={true}
                          />
                        );
                      })()}
                    </div>

                    {/* GPS Coordinates & Navigation Bar (รูปแบบเดียวกับหน้าคำนวณ) */}
                    <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 px-1 gap-2 pt-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-gray-400 shrink-0">พิกัด GPS:</span>
                        <strong className="font-mono text-gray-800 text-[11px] sm:text-xs truncate">
                          {selectedTask.lat.toFixed(6)}, {selectedTask.lng.toFixed(6)}
                        </strong>
                        {userGps && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full ml-1 shrink-0">
                            ห่าง ~{calculateGpsDistanceKm(userGps.lat, userGps.lng, selectedTask.lat, selectedTask.lng)} กม.
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* ปุ่มนำทาง (GPS Navigation Button) */}
                        <button
                          type="button"
                          onClick={() => handleStartNavigation(selectedTask.lat!, selectedTask.lng!)}
                          disabled={navigatingGps}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg shadow-2xs font-bold text-xs transition active:scale-95 cursor-pointer"
                          title="เริ่มนำทางด้วย GPS ระหว่างตำแหน่งของคุณกับพิกัดปลายทาง"
                        >
                          <Navigation size={13} className={navigatingGps ? "animate-spin" : ""} />
                          <span>{navigatingGps ? "กำลังคำนวณ..." : "🧭 นำทาง (เริ่มเดินทาง)"}</span>
                        </button>

                        {/* Google Maps Button */}
                        <a
                          href={`https://www.google.com/maps?q=${selectedTask.lat},${selectedTask.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg shadow-2xs font-semibold text-[11px] transition shrink-0 hover:border-slate-400 hover:text-govblue-900 group"
                          title="เปิดตำแหน่งนี้บน Google Maps"
                        >
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform">
                            <path fill="#EA4335" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                            <circle cx="12" cy="9" r="2.8" fill="#FFFFFF"/>
                            <circle cx="12" cy="9" r="1.5" fill="#4285F4"/>
                          </svg>
                          <span>Google Maps</span>
                          <ExternalLink size={11} className="text-slate-400" />
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-xs text-center text-gray-400">
                    ไม่ได้ระบุพิกัดแผนที่สำหรับงานนี้
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {isSup && selectedTask.status === "submitted" && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = selectedTask;
                      setSelectedTask(null);
                      openReviewModal(t);
                    }}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    <span>ตรวจสอบและอนุมัติงานนี้</span>
                  </button>
                )}

                {!isSup && (selectedTask.status === "accepted" || selectedTask.status === "in_progress" || selectedTask.status === "revision_requested") && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = selectedTask;
                      setSelectedTask(null);
                      openSubmissionModal(t);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>กรอกข้อมูล / ส่งผลงานให้หัวหน้าตรวจ</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleCloseTaskModal}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Modal จัดการทีม (Supervisor Team Management Modal) */}
      {teamModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-govblue-800 font-bold text-base">
                <Users size={20} className="text-govblue-600" />
                <span>จัดการทีมสำรวจ (Team Management)</span>
              </div>
              <button
                onClick={() => setTeamModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Invite Form */}
            <form onSubmit={handleInvite} className="p-3.5 bg-govblue-50/60 rounded-xl border border-govblue-100 space-y-2">
              <label className="block text-xs font-bold text-govblue-900">
                เชิญลูกน้องเข้าทีม (ส่งคำเชิญผ่าน Username)
              </label>
              <div className="flex gap-2">
                <input
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="ระบุ username เช่น normal"
                  className="flex-1 text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
                  required
                />
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 bg-govblue-800 hover:bg-govblue-900 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {inviting ? "กำลังส่ง..." : "ส่งคำเชิญ"}
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                เมื่อส่งคำเชิญ พนักงานสำรวจจะได้รับการแจ้งเตือนบนระบบของเขา และสามารถกด "ยอมรับ" เพื่อเข้าร่วมทีมได้
              </p>
            </form>

            {/* Team Members List */}
            {(() => {
              const safeTeam = Array.isArray(myTeam) ? myTeam : [];
              return (
                <div>
                  <div className="text-xs font-bold text-gray-800 mb-2 flex items-center justify-between">
                    <span>รายชื่อสมาชิกในทีมของคุณ</span>
                    <span className="text-gray-400 font-normal">({safeTeam.length} คน)</span>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {safeTeam.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                        ยังไม่มีสมาชิกในทีม เชิญพนักงานสำรวจโดยกรอกชื่อผู้ใช้งานด้านบน
                      </div>
                    ) : (
                      safeTeam.map((m) => {
                        if (!m) return null;
                        return (
                          <div
                            key={m.id || m.subordinate_public_id}
                            className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 truncate">
                                {m.subordinate_name || m.subordinate_username}
                              </div>
                              <div className="text-[11px] text-gray-500">@{m.subordinate_username}</div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  m.status === "accepted"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : m.status === "declined"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {m.status === "accepted"
                                  ? "✓ เข้าร่วมแล้ว"
                                  : m.status === "declined"
                                  ? "✕ ปฏิเสธ"
                                  : "⏳ รอการตอบรับ"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m.subordinate_public_id, m.subordinate_name || m.subordinate_username || "", m.subordinate_username)}
                                className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition"
                                title="นำออกจากทีม"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setTeamModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal คำร้องจากฝ่ายบัญชี (Supervisor Revision Requests Modal) */}
      {requestsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-govblue-800 font-bold text-base">
                <AlertCircle size={20} className="text-amber-500" />
                <span>คำร้องขอแก้ไข / ตรวจสอบ จากฝ่ายบัญชี</span>
              </div>
              <button
                onClick={() => setRequestsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              ฝ่ายบัญชีได้สร้างคำร้องขอให้ตรวจสอบหรือแก้ไขข้อมูล ท่านสามารถค้นหาและสั่งงานต่อให้ลูกน้องในทีมลงพื้นที่หรือแก้ไขข้อมูลได้ทันที
            </p>

            {/* Keyword Search and Filters */}
            <div className="space-y-2.5 bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
                <input
                  type="text"
                  placeholder="พิมพ์ค้นหาคำร้อง เช่น รหัสแปลง/อาคาร, รายละเอียดคำร้อง, ผู้สร้าง..."
                  value={reqSearch}
                  onChange={(e) => setReqSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none bg-white"
                />
                {reqSearch && (
                  <button
                    onClick={() => setReqSearch("")}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                    title="ล้างคำค้นหา"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-gray-500 text-[11px] font-medium">สถานะ:</span>
                  {[
                    { id: "all", label: "ทั้งหมด" },
                    { id: "pending", label: "⏳ รอสั่งงาน" },
                    { id: "assigned", label: "✓ สั่งงานแล้ว" },
                    { id: "resolved", label: "เสร็จสิ้น" },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setReqStatusFilter(st.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                        reqStatusFilter === st.id
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                      }`}
                    >
                      {st.label}{" "}
                      <span className="opacity-75">
                        (
                        {st.id === "all"
                          ? (Array.isArray(revisionRequests) ? revisionRequests : []).length
                          : (Array.isArray(revisionRequests) ? revisionRequests : []).filter((r) => r && r.status === st.id).length}
                        )
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-gray-500 font-medium">ประเภท:</span>
                  <button
                    type="button"
                    onClick={() => setReqTypeFilter("all")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      reqTypeFilter === "all"
                        ? "bg-govblue-800 text-white font-bold"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => setReqTypeFilter("land")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      reqTypeFilter === "land"
                        ? "bg-govblue-800 text-white font-bold"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    ที่ดิน
                  </button>
                  <button
                    type="button"
                    onClick={() => setReqTypeFilter("building")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      reqTypeFilter === "building"
                        ? "bg-govblue-800 text-white font-bold"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    อาคาร
                  </button>
                </div>
              </div>
            </div>

            {/* Request Items List */}
            {(() => {
              const safeRequests = Array.isArray(revisionRequests) ? revisionRequests : [];
              const filteredRequests = safeRequests.filter((req) => {
                if (!req) return false;
                if (reqStatusFilter !== "all" && req.status !== reqStatusFilter) return false;
                if (reqTypeFilter !== "all" && req.target_type !== reqTypeFilter) return false;
                if (reqSearch.trim()) {
                  const q = reqSearch.toLowerCase();
                  const matchCode = (req.target_code || "").toLowerCase().includes(q);
                  const matchRemarks = (req.remarks || "").toLowerCase().includes(q);
                  const matchCreator = (req.creator_name || "").toLowerCase().includes(q);
                  const matchType = (req.target_type === "land" ? "แปลงที่ดิน" : "สิ่งปลูกสร้าง").toLowerCase().includes(q);
                  const matchReqType = (req.request_type === "survey_new" ? "ขอสำรวจใหม่" : "ขอแก้ไขข้อมูล").toLowerCase().includes(q);
                  return matchCode || matchRemarks || matchCreator || matchType || matchReqType;
                }
                return true;
              });

              return (
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {filteredRequests.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500 border border-dashed rounded-xl bg-gray-50/50">
                      {reqSearch || reqStatusFilter !== "all" || reqTypeFilter !== "all"
                        ? `ไม่พบคำร้องที่ตรงกับเงื่อนไขการค้นหา ${reqSearch ? `"${reqSearch}"` : ""}`
                        : "ยังไม่มีคำร้องจากฝ่ายบัญชีในขณะนี้"}
                    </div>
                  ) : (
                    filteredRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs hover:border-amber-300 transition"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-govblue-900">
                              {req.target_type === "land" ? "แปลงที่ดิน" : "สิ่งปลูกสร้าง"}: {req.target_code || "ทั่วไป"}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                              {req.request_type === "survey_new" ? "ขอสำรวจใหม่" : "ขอแก้ไขข้อมูล"}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              req.status === "assigned"
                                ? "bg-emerald-100 text-emerald-800"
                                : req.status === "resolved"
                                ? "bg-gray-100 text-gray-700"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {req.status === "assigned" ? "✓ สั่งงานแล้ว" : req.status === "resolved" ? "เสร็จสิ้น" : "⏳ รอสั่งงาน"}
                          </span>
                        </div>

                        <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-gray-700 whitespace-pre-wrap">
                          "{req.remarks}"
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                          <span>ผู้สร้างคำร้อง: {req.creator_name || "พนักงานบัญชี"} • {fmtDateTime(req.created_at)}</span>
                          {req.status === "pending" && (
                            <Link
                              href={`/tasks/new?request_id=${req.id || ""}&target_type=${req.target_type}&target_code=${req.target_code || ""}&request_type=${req.request_type || "revision"}&remarks=${encodeURIComponent(req.remarks || "")}`}
                              onClick={() => setRequestsModalOpen(false)}
                              className="px-3 py-1 bg-govblue-800 hover:bg-govblue-900 text-white rounded-md font-semibold text-[11px] transition shadow-xs"
                            >
                              สั่งงานแก้ไขตามคำร้องนี้ →
                            </Link>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })()}

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setRequestsModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal กรอกและส่งข้อมูลผลงานแบบ 4 ขั้นตอน (Subordinate Multi-Step Submission Wizard) */}
      {submissionModalOpen && submittingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100">
            {/* Modal Top Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-govblue-800 to-govblue-700 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="text-xs text-blue-200">แบบฟอร์มส่งมอบผลงานสำรวจ (Field Survey Data Submission)</div>
                <h3 className="text-base font-bold truncate">{submittingTask.title}</h3>
              </div>
              <button
                onClick={() => setSubmissionModalOpen(false)}
                className="text-blue-200 hover:text-white p-1 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Step Progress Stepper Bar */}
            <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-gray-200 flex items-center justify-between text-xs font-semibold overflow-x-auto gap-2 shrink-0">
              {[
                { step: 1, title: "1. กรอกข้อมูลทั่วไป", icon: ClipboardList },
                { step: 2, title: `2. ใส่รูปภาพ (${submissionPhotos.length})`, icon: Camera },
                { step: 3, title: "3. วาดพื้นที่ดาวเทียม", icon: Layers },
                { step: 4, title: "4. ตรวจสอบก่อนส่ง", icon: FileCheck2 },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setSubmissionStep(s.step as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer text-xs ${
                    submissionStep === s.step
                      ? "bg-govblue-800 text-white shadow-xs font-bold"
                      : submissionStep > s.step
                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200 font-medium"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <s.icon
                    size={14}
                    className={
                      submissionStep === s.step
                        ? "text-govgold-400"
                        : submissionStep > s.step
                        ? "text-emerald-600"
                        : "text-gray-400"
                    }
                  />
                  <span>{s.title}</span>
                </button>
              ))}
            </div>

            {/* Step Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Supervisor Feedback (If revision requested) */}
              {submittingTask.status === "revision_requested" && submittingTask.supervisor_feedback && (
                <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-xl space-y-1 text-xs">
                  <div className="font-bold text-orange-900 flex items-center gap-1.5">
                    <AlertCircle size={15} className="text-orange-600" />
                    <span>หัวหน้างานส่งกลับให้แก้ไข:</span>
                  </div>
                  <p className="text-orange-800 whitespace-pre-wrap">{submittingTask.supervisor_feedback}</p>
                </div>
              )}

              {/* STEP 1: กรอกข้อมูลทั่วไป (General Data) */}
              {submissionStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      สรุปผลการปฏิบัติงาน / หมายเหตุรายงานหัวหน้า
                    </label>
                    <textarea
                      rows={2}
                      value={submissionSummary}
                      onChange={(e) => setSubmissionSummary(e.target.value)}
                      placeholder="เช่น ลงพื้นที่สำรวจรังวัดแนวเขตเรียบร้อย หรือ ตรวจนับและจัดทำแบบฟอร์มบันทึกข้อมูลเรียบร้อย..."
                      className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
                    />
                  </div>

                  {/* Dynamic Batch Data Items Form */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-govblue-900 uppercase">
                          รายการข้อมูลทรัพย์สินที่จะส่งให้หัวหน้าอนุมัติ ({batchItems.length} รายการ)
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          ประเภท: {submittingTask.target_type === "building" ? "สิ่งปลูกสร้าง (Buildings)" : "แปลงที่ดิน (Land Parcels)"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddBatchItem}
                        className="px-2.5 py-1 text-xs font-semibold text-govblue-700 bg-govblue-50 hover:bg-govblue-100 rounded-lg border border-govblue-200 flex items-center gap-1"
                      >
                        <Plus size={13} /> เพิ่มรายการอีก
                      </button>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto p-1">
                      {submittingTask.target_type === "building"
                        ? batchItems.map((item, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 relative">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-gray-600">อาคารรายการที่ {idx + 1}</span>
                                {batchItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBatchItem(idx)}
                                    className="text-xs text-rose-500 hover:text-rose-700"
                                  >
                                    ลบรายการนี้
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] text-gray-500 block">รหัสอาคาร *</label>
                                  <input
                                    value={item.bldg_code}
                                    onChange={(e) => handleBatchFieldChange(idx, "bldg_code", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">ชื่ออาคาร *</label>
                                  <input
                                    value={item.name}
                                    onChange={(e) => handleBatchFieldChange(idx, "name", e.target.value)}
                                    placeholder="เช่น อาคารสถานี"
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">รหัสแปลงที่ดินตั้งอยู่</label>
                                  <input
                                    value={item.land_code}
                                    onChange={(e) => handleBatchFieldChange(idx, "land_code", e.target.value)}
                                    placeholder="เช่น LP-2569-001"
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">โครงสร้างวัสดุ</label>
                                  <input
                                    value={item.material_type}
                                    onChange={(e) => handleBatchFieldChange(idx, "material_type", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">จำนวนชั้น</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.num_fl}
                                    onChange={(e) => handleBatchFieldChange(idx, "num_fl", Number(e.target.value))}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">สภาพอาคาร</label>
                                  <select
                                    value={item.bld_condition_type}
                                    onChange={(e) => handleBatchFieldChange(idx, "bld_condition_type", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  >
                                    <option value="ดี">ดี</option>
                                    <option value="พอใช้">พอใช้</option>
                                    <option value="ทรุดโทรม">ทรุดโทรม</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">เลขที่/ที่ตั้ง</label>
                                  <input
                                    value={item.address_no || ""}
                                    onChange={(e) => handleBatchFieldChange(idx, "address_no", e.target.value)}
                                    placeholder="เช่น 123/4"
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">ตำบล/แขวง</label>
                                  <input
                                    value={item.subdistrict || ""}
                                    onChange={(e) => handleBatchFieldChange(idx, "subdistrict", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">อำเภอ/เขต</label>
                                  <input
                                    value={item.district || ""}
                                    onChange={(e) => handleBatchFieldChange(idx, "district", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">จังหวัด</label>
                                  <input
                                    value={item.province || ""}
                                    onChange={(e) => handleBatchFieldChange(idx, "province", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                              </div>
                            </div>
                          ))
                        : batchItems.map((item, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 relative">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-gray-600">แปลงที่ดินรายการที่ {idx + 1}</span>
                                {batchItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBatchItem(idx)}
                                    className="text-xs text-rose-500 hover:text-rose-700"
                                  >
                                    ลบรายการนี้
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div>
                                  <label className="text-[10px] text-gray-500 block">รหัสที่ดิน *</label>
                                  <input
                                    value={item.land_code}
                                    onChange={(e) => handleBatchFieldChange(idx, "land_code", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">เลขที่โฉนด</label>
                                  <input
                                    value={item.deed_no}
                                    onChange={(e) => handleBatchFieldChange(idx, "deed_no", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">ประเภทที่ดิน</label>
                                  <input
                                    value={item.srt_land_type}
                                    onChange={(e) => handleBatchFieldChange(idx, "srt_land_type", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">การใช้ประโยชน์</label>
                                  <input
                                    value={item.land_use}
                                    onChange={(e) => handleBatchFieldChange(idx, "land_use", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">ไร่</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.rai}
                                    onChange={(e) => handleBatchFieldChange(idx, "rai", Number(e.target.value))}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">งาน</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="3"
                                    value={item.ngan}
                                    onChange={(e) => handleBatchFieldChange(idx, "ngan", Number(e.target.value))}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">ตารางวา</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.wa}
                                    onChange={(e) => handleBatchFieldChange(idx, "wa", Number(e.target.value))}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">กว้าง × ยาว (ม.)</label>
                                  <div className="flex gap-1">
                                    <input
                                      type="number"
                                      placeholder="กว้าง"
                                      value={item.width}
                                      onChange={(e) => handleBatchFieldChange(idx, "width", Number(e.target.value))}
                                      className="w-1/2 text-xs p-1.5 border rounded bg-white"
                                    />
                                    <input
                                      type="number"
                                      placeholder="ยาว"
                                      value={item.length}
                                      onChange={(e) => handleBatchFieldChange(idx, "length", Number(e.target.value))}
                                      className="w-1/2 text-xs p-1.5 border rounded bg-white"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">เลขที่/ที่ตั้ง</label>
                                  <input
                                    value={item.address_no || ""}
                                    onChange={(e) => handleBatchFieldChange(idx, "address_no", e.target.value)}
                                    placeholder="เช่น 123/4"
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">ตำบล/แขวง</label>
                                  <input
                                    value={item.subdistrict || ""}
                                    onChange={(e) => handleBatchFieldChange(idx, "subdistrict", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">อำเภอ/เขต</label>
                                  <input
                                    value={item.district || ""}
                                    onChange={(e) => handleBatchFieldChange(idx, "district", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 block">จังหวัด</label>
                                  <input
                                    value={item.province || ""}
                                    onChange={(e) => handleBatchFieldChange(idx, "province", e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: ใส่รูปภาพ (Survey Photos) */}
              {submissionStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-govblue-900 uppercase flex items-center gap-1.5">
                        <Camera size={15} className="text-govblue-700" />
                        แนบรูปภาพหลักฐานการลงพื้นที่สำรวจ ({submissionPhotos.length} ภาพ)
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        อัปโหลดภาพถ่ายสถานที่จริง สภาพแปลงที่ดิน หมุดหลักเขต หรือสิ่งปลูกสร้าง
                      </p>
                    </div>

                    {/* Hidden Inputs */}
                    <input
                      id="ams-photo-file-input"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    <input
                      id="ams-photo-camera-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />

                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="ams-photo-camera-input"
                        className="px-3 py-1.5 bg-govblue-50 hover:bg-govblue-100 text-govblue-700 border border-govblue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                      >
                        <Camera size={14} />
                        <span>ถ่ายรูปกล้อง</span>
                      </label>
                      <label
                        htmlFor="ams-photo-file-input"
                        className="px-3 py-1.5 bg-govblue-700 hover:bg-govblue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                      >
                        <Upload size={14} />
                        <span>เลือกรูปภาพ</span>
                      </label>
                    </div>
                  </div>

                  {/* Photos Grid */}
                  {submissionPhotos.length === 0 ? (
                    <label
                      htmlFor="ams-photo-file-input"
                      className="border-2 border-dashed border-gray-300 hover:border-govblue-400 bg-gray-50/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition"
                    >
                      <div className="w-12 h-12 rounded-full bg-govblue-50 text-govblue-700 flex items-center justify-center mb-2 shadow-2xs">
                        <Camera size={24} />
                      </div>
                      <span className="font-bold text-gray-700 text-xs">คลิกเพื่อเลือกรูปภาพ หรือ ถ่ายรูปหลักฐานการลงพื้นที่</span>
                      <span className="text-[11px] text-gray-400 mt-0.5">
                        รองรับไฟล์ JPG, PNG, WEBP (ระบบจะบีบอัดขนาดภาพให้เหมาะสมอัตโนมัติ)
                      </span>
                    </label>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-1">
                      {submissionPhotos.map((p, pIdx) => (
                        <div
                          key={p.id}
                          className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs flex flex-col group relative"
                        >
                          {/* Image preview */}
                          <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                            <img
                              src={p.url}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-md font-mono">
                              #{pIdx + 1} • {p.sizeKb} KB
                            </div>
                            <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setPreviewPhoto({ url: p.url, name: p.name, caption: p.caption })}
                                className="p-1 bg-black/60 hover:bg-black text-white rounded-md transition"
                                title="ขยายดูภาพ"
                              >
                                <ZoomIn size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(p.id)}
                                className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition"
                                title="ลบรูปนี้"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Caption Input */}
                          <div className="p-2.5 space-y-1 bg-gray-50 flex-1 flex flex-col justify-between">
                            <input
                              type="text"
                              value={p.caption}
                              onChange={(e) => handlePhotoCaptionChange(p.id, e.target.value)}
                              placeholder="ระบุคำอธิบายภาพ (เช่น สภาพที่ดิน, หลักหมุดที่ 1...)"
                              className="w-full text-xs p-1.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-govblue-500 focus:outline-hidden"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-2 text-blue-900 text-xs">
                    <Info size={15} className="text-blue-600 shrink-0" />
                    <span>
                      แนบภาพถ่ายอย่างน้อย 1-4 ภาพ เพื่อให้หัวหน้างานตรวจสอบความถูกต้องของแปลงสำรวจจริง
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 3: วาดพื้นที่บน Google Map ดาวเทียม (Satellite Polygon & Auto Area) */}
              {submissionStep === 3 && (
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-govblue-900 uppercase flex items-center gap-1.5">
                      <Layers size={15} className="text-emerald-600" />
                      วาดพื้นที่บนแผนที่ภาพถ่ายดาวเทียม Google Satellite (คำนวณขนาดพื้นที่อัตโนมัติ)
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      คลิกปักจุดบนแผนที่ภาพถ่ายดาวเทียมเพื่อตีเส้นล้อมกรอบแนวเขตแปลงที่ดิน ระบบจะคำนวณขนาดเนื้อที่ (ไร่-งาน-วา และ ตารางเมตร) พร้อมลงข้อมูลในแบบฟอร์มให้อัตโนมัติ
                    </p>
                  </div>

                  {/* Satellite Polygon Map Component */}
                  <SurveyPolygonMap
                    initialLat={submittingTask.lat}
                    initialLng={submittingTask.lng}
                    initialPoints={submissionPolygon}
                    onChange={handlePolygonChange}
                    height="380px"
                  />

                  {/* Auto-filled area confirmation */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold text-emerald-950 block">
                          {submissionArea && submissionArea.sqm > 0
                            ? `คำนวณขนาดพื้นที่อัตโนมัติ: ${submissionArea.formattedThai} (${submissionArea.sqm.toLocaleString()} ตร.ม.)`
                            : "ยังไม่ได้ตีเส้นแนวเขต (คลิกบนแผนที่อย่างน้อย 3 จุด)"}
                        </span>
                        <span className="text-[11px] text-emerald-800">
                          {submissionArea && submissionArea.sqm > 0
                            ? "✓ ระบบได้บันทึกค่าขนาดพื้นที่เข้าสู่แบบฟอร์มข้อมูลทรัพย์สินรายการแรกให้โดยอัตโนมัติแล้ว"
                            : "ท่านสามารถคลิกตามขอบเขตแปลงจริงในภาพถ่ายดาวเทียมเพื่อคำนวณพื้นที่ได้ทันที"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: ตรวจเช็คข้อมูลก่อนส่ง (Review & Summary) */}
              {submissionStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <FileCheck2 size={18} className="text-govblue-800" />
                    <div>
                      <h4 className="text-xs font-bold text-govblue-900 uppercase">
                        ตรวจเช็ครายละเอียดความถูกต้องก่อนส่งมอบให้หัวหน้างาน
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        กรุณาตรวจสอบข้อมูล ผลการคำนวณ และภาพถ่ายสำรวจให้ครบถ้วนก่อนกดยืนยันส่ง
                      </p>
                    </div>
                  </div>

                  {/* Review Cards Grid */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {/* General Summary Card */}
                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1.5">
                      <span className="text-[11px] text-gray-400 font-bold uppercase block">
                        ข้อมูลงานและหมายเหตุ
                      </span>
                      <div className="font-bold text-gray-800 text-xs">{submittingTask.title}</div>
                      <div className="text-[11px] text-govblue-700 font-semibold">
                        ประเภท: {submittingTask.target_type === "building" ? "สิ่งปลูกสร้าง (Buildings)" : "แปลงที่ดิน (Land Parcels)"}
                      </div>
                      {submissionSummary ? (
                        <div className="pt-1 text-gray-600 italic">"{submissionSummary}"</div>
                      ) : (
                        <div className="text-gray-400 italic text-[11px]">— ไม่ได้ระบุหมายเหตุ —</div>
                      )}
                    </div>

                    {/* Calculated Area Card */}
                    <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-1.5">
                      <span className="text-[11px] text-emerald-800 font-bold uppercase block flex items-center gap-1">
                        <span>📐</span> ขนาดพื้นที่คำนวณจากดาวเทียม
                      </span>
                      {submissionArea && submissionArea.sqm > 0 ? (
                        <div>
                          <div className="text-sm font-extrabold text-emerald-950">
                            {submissionArea.formattedThai}
                          </div>
                          <div className="text-xs text-emerald-800 font-medium">
                            {submissionArea.sqm.toLocaleString()} ตารางเมตร ({submissionPolygon.length} จุดแนวเขต)
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-400 text-xs italic">ไม่ได้วาดขอบเขตแนวเขตบนดาวเทียม</div>
                      )}
                    </div>
                  </div>

                  {/* Satellite Polygon Map Preview (Read-only) */}
                  {submissionPolygon.length >= 3 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <Layers size={14} className="text-emerald-600" />
                        แนวเขตแปลงบนภาพถ่ายดาวเทียมที่วาดไว้:
                      </span>
                      <div className="rounded-xl overflow-hidden border border-gray-300">
                        <SurveyPolygonMap
                          initialPoints={submissionPolygon}
                          readOnly={true}
                          height="200px"
                        />
                      </div>
                    </div>
                  )}

                  {/* Photos Preview Gallery */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Camera size={14} className="text-govblue-600" />
                      ภาพถ่ายลงพื้นที่สำรวจ ({submissionPhotos.length} ภาพ):
                    </span>
                    {submissionPhotos.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {submissionPhotos.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => setPreviewPhoto({ url: p.url, name: p.name, caption: p.caption })}
                            className="aspect-video bg-black rounded-xl overflow-hidden border border-gray-200 relative cursor-pointer group shadow-2xs"
                          >
                            <img src={p.url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ZoomIn size={16} />
                            </div>
                            {p.caption && (
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1 text-[10px] text-white truncate">
                                {p.caption}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 border rounded-xl text-gray-400 text-center text-xs italic">
                        ไม่ได้แนบรูปภาพสำรวจ
                      </div>
                    )}
                  </div>

                  {/* Asset Items Summary Table */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-gray-700">
                      รายการทรัพย์สินที่จะบันทึกเข้าระบบ ({batchItems.length} รายการ):
                    </span>
                    <div className="border border-gray-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                          {submittingTask.target_type === "building" ? (
                            <tr>
                              <th className="p-2">รหัสอาคาร</th>
                              <th className="p-2">ชื่ออาคาร</th>
                              <th className="p-2">แปลงที่ดิน</th>
                              <th className="p-2">โครงสร้าง</th>
                              <th className="p-2">ชั้น</th>
                              <th className="p-2">สภาพ</th>
                            </tr>
                          ) : (
                            <tr>
                              <th className="p-2">รหัสที่ดิน</th>
                              <th className="p-2">โฉนด</th>
                              <th className="p-2">ประเภทที่ดิน</th>
                              <th className="p-2">การใช้ประโยชน์</th>
                              <th className="p-2">เนื้อที่ (ไร่-งาน-วา)</th>
                              <th className="p-2">ที่ตั้ง</th>
                            </tr>
                          )}
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {batchItems.map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              {submittingTask.target_type === "building" ? (
                                <>
                                  <td className="p-2 font-bold text-govblue-800">{it.bldg_code || "-"}</td>
                                  <td className="p-2 font-medium">{it.name || "-"}</td>
                                  <td className="p-2 text-gray-600">{it.land_code || "-"}</td>
                                  <td className="p-2 text-gray-600">{it.material_type || "-"}</td>
                                  <td className="p-2">{it.num_fl || 1} ชั้น</td>
                                  <td className="p-2">{it.bld_condition_type || "ดี"}</td>
                                </>
                              ) : (
                                <>
                                  <td className="p-2 font-bold text-govblue-800">{it.land_code || "-"}</td>
                                  <td className="p-2 text-gray-700">{it.deed_no || "-"}</td>
                                  <td className="p-2 text-gray-600">{it.srt_land_type || "-"}</td>
                                  <td className="p-2 text-gray-600">{it.land_use || "-"}</td>
                                  <td className="p-2 font-semibold text-emerald-800">
                                    {it.rai || 0} ไร่ {it.ngan || 0} งาน {it.wa || 0} วา
                                  </td>
                                  <td className="p-2 text-gray-500 max-w-[150px] truncate">
                                    {[it.address_no, it.subdistrict, it.district, it.province].filter(Boolean).join(" ") || "-"}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs">
                    ℹ️ <strong>การดำเนินการส่งมอบ:</strong> เมื่อกด "ยืนยันส่งให้หัวหน้าตรวจสอบ" สถานะจะเปลี่ยนเป็น "ส่งตรวจแล้ว" เพื่อรอหัวหน้างานเข้าตรวจประเมินและอนุมัติเข้าฐานข้อมูลจริง
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Footer (Navigation Controls) */}
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2 shrink-0">
              {/* Left Back / Cancel Button */}
              {submissionStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setSubmissionModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
                >
                  ยกเลิก
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSubmissionStep((prev) => (prev - 1) as any)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  <span>ย้อนกลับ</span>
                </button>
              )}

              {/* Right Next / Submit Button */}
              <div className="flex items-center gap-2">
                {submissionStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setSubmissionStep((prev) => (prev + 1) as any)}
                    className="px-5 py-2 bg-govblue-800 hover:bg-govblue-900 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>
                      {submissionStep === 1
                        ? "ถัดไป: ใส่รูปภาพสำรวจ"
                        : submissionStep === 2
                        ? "ถัดไป: วาดพื้นที่บน Google Map"
                        : "ถัดไป: ตรวจเช็คข้อมูลก่อนส่ง"}
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubmitTaskData()}
                    disabled={submittingData}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 size={15} />
                    <span>{submittingData ? "กำลังส่งข้อมูล..." : "✓ ยืนยันส่งให้หัวหน้าตรวจสอบ"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal ตรวจสอบผลงานสำหรับหัวหน้างาน (Supervisor Review & Approval Modal) */}
      {reviewModalOpen && reviewingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-800 to-indigo-800 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="text-xs text-purple-200">ตรวจสอบและอนุมัติผลงานสำรวจ</div>
                <h3 className="text-base font-bold truncate">{reviewingTask.title}</h3>
              </div>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="text-purple-200 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {(() => {
              let subData: any = null;
              if (reviewingTask.submission_data) {
                if (typeof reviewingTask.submission_data === "string") {
                  try {
                    subData = JSON.parse(reviewingTask.submission_data);
                  } catch {
                    subData = null;
                  }
                } else {
                  subData = reviewingTask.submission_data;
                }
              }
              const summary = subData?.summary;
              const items = subData?.items || subData?.lands || subData?.buildings || [];
              const photos: any[] = Array.isArray(subData?.photos) ? subData.photos : [];
              const polygon: LatLngPoint[] = Array.isArray(subData?.polygon) ? subData.polygon : [];
              const areaThai =
                subData?.area_thai ||
                (subData?.rai != null
                  ? `${subData.rai} ไร่ ${subData.ngan || 0} งาน ${subData.wa || 0} ตร.ว.`
                  : null);
              const areaSqm = subData?.area_sqm;

              return (
                <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                  <div className="grid sm:grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                    <div>
                      <span className="text-gray-400 block text-[11px]">ผู้ส่งมอบงาน (ลูกน้อง)</span>
                      <span className="font-bold text-gray-800">{reviewingTask.assignee_name || "เจ้าหน้าที่"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[11px]">ประเภททรัพย์สิน</span>
                      <span className="font-bold text-govblue-800">
                        {reviewingTask.target_type === "building" ? "สิ่งปลูกสร้าง (Buildings)" : "แปลงที่ดิน (Land Parcels)"}
                      </span>
                    </div>
                    {summary && (
                      <div className="sm:col-span-2 pt-1 border-t border-gray-200">
                        <span className="text-gray-400 block text-[11px]">หมายเหตุสรุปจากลูกน้อง:</span>
                        <p className="text-gray-700 italic font-medium">"{summary}"</p>
                      </div>
                    )}
                  </div>

                  {/* Calculated Area Badge if available */}
                  {(areaThai || areaSqm) && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📐</span>
                        <div>
                          <span className="text-[11px] text-emerald-800 font-semibold block">
                            ขนาดพื้นที่สำรวจ (คำนวณจากแผนที่ดาวเทียม):
                          </span>
                          <span className="text-emerald-950 font-extrabold text-xs sm:text-sm">
                            {areaThai} {areaSqm ? `(${Number(areaSqm).toLocaleString()} ตร.ม.)` : ""}
                          </span>
                        </div>
                      </div>
                      {polygon.length > 0 && (
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                          {polygon.length} จุดแนวเขต
                        </span>
                      )}
                    </div>
                  )}

                  {/* Satellite Polygon Map Preview */}
                  {polygon.length >= 3 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <Layers size={14} className="text-emerald-600" />
                        แนวเขตแปลงบนภาพถ่ายดาวเทียม:
                      </span>
                      <div className="rounded-xl overflow-hidden border border-gray-300">
                        <SurveyPolygonMap
                          initialPoints={polygon}
                          readOnly={true}
                          height="200px"
                        />
                      </div>
                    </div>
                  )}

                  {/* Survey Photos Gallery */}
                  {photos.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <Camera size={14} className="text-govblue-600" />
                        ภาพถ่ายสำรวจภาคสนาม ({photos.length} ภาพ):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {photos.map((p: any, idx: number) => (
                          <div
                            key={p.id || idx}
                            onClick={() =>
                              setPreviewPhoto({
                                url: p.url,
                                name: p.name || `ภาพที่ ${idx + 1}`,
                                caption: p.caption,
                              })
                            }
                            className="aspect-video bg-black rounded-xl overflow-hidden border border-gray-200 relative cursor-pointer group shadow-2xs hover:border-purple-400 transition"
                          >
                            <img
                              src={p.url}
                              alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ZoomIn size={16} />
                            </div>
                            {p.caption && (
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1 text-[10px] text-white truncate">
                                {p.caption}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Submitted Data Table */}
                  <div>
                    <h4 className="font-bold text-gray-800 mb-2">
                      ข้อมูลที่ลูกน้องกรอกเข้ามาเพื่อขออนุมัติ:
                    </h4>
                    {items && items.length > 0 ? (
                      <div className="border border-gray-200 rounded-xl overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                            {reviewingTask.target_type === "building" ? (
                              <tr>
                                <th className="p-2.5">รหัสอาคาร</th>
                                <th className="p-2.5">ชื่ออาคาร</th>
                                <th className="p-2.5">ที่ตั้ง / สถานที่</th>
                                <th className="p-2.5">แปลงที่ดิน</th>
                                <th className="p-2.5">โครงสร้าง</th>
                                <th className="p-2.5">ชั้น</th>
                                <th className="p-2.5">สภาพ</th>
                              </tr>
                            ) : (
                              <tr>
                                <th className="p-2.5">รหัสที่ดิน</th>
                                <th className="p-2.5">เลขที่โฉนด</th>
                                <th className="p-2.5">ที่ตั้ง / สถานที่</th>
                                <th className="p-2.5">ประเภทที่ดิน</th>
                                <th className="p-2.5">การใช้ประโยชน์</th>
                                <th className="p-2.5">เนื้อที่ (ไร่-งาน-วา)</th>
                                <th className="p-2.5">ขนาด กว้าง×ยาว</th>
                              </tr>
                            )}
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {items.map((it: any, i: number) => (
                              <tr key={i} className="hover:bg-purple-50/40">
                                {reviewingTask.target_type === "building" ? (
                                  <>
                                    <td className="p-2.5 font-bold text-govblue-800">{it.bldg_code || "-"}</td>
                                    <td className="p-2.5 font-medium">{it.name || "-"}</td>
                                    <td className="p-2.5 text-gray-600 max-w-[200px] truncate" title={[it.address_no, it.subdistrict, it.district, it.province, it.postal_code].filter(Boolean).join(" ")}>
                                      {(it.subdistrict || it.province || it.address_no) ? (
                                        <div className="flex items-center gap-1 text-[11px] text-gray-700">
                                          <span className="text-govblue-600 shrink-0">📍</span>
                                          <span className="truncate">{[it.address_no, it.subdistrict, it.district, it.province, it.postal_code].filter(Boolean).join(" ")}</span>
                                        </div>
                                      ) : "-"}
                                    </td>
                                    <td className="p-2.5 text-gray-600">{it.land_code || "-"}</td>
                                    <td className="p-2.5 text-gray-600">{it.material_type || "-"}</td>
                                    <td className="p-2.5">{it.num_fl || 1} ชั้น</td>
                                    <td className="p-2.5">{it.bld_condition_type || "ดี"}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-2.5 font-bold text-govblue-800">{it.land_code || "-"}</td>
                                    <td className="p-2.5 text-gray-700">{it.deed_no || "-"}</td>
                                    <td className="p-2.5 text-gray-600 max-w-[200px] truncate" title={[it.address_no, it.subdistrict, it.district, it.province, it.postal_code].filter(Boolean).join(" ")}>
                                      {(it.subdistrict || it.province || it.address_no) ? (
                                        <div className="flex items-center gap-1 text-[11px] text-gray-700">
                                          <span className="text-govblue-600 shrink-0">📍</span>
                                          <span className="truncate">{[it.address_no, it.subdistrict, it.district, it.province, it.postal_code].filter(Boolean).join(" ")}</span>
                                        </div>
                                      ) : "-"}
                                    </td>
                                    <td className="p-2.5 text-govblue-700">{it.srt_land_type || "-"}</td>
                                    <td className="p-2.5 text-gray-600">{it.land_use || "-"}</td>
                                    <td className="p-2.5 font-semibold text-gray-800">
                                      {it.rai || 0} ไร่ {it.ngan || 0} งาน {it.wa || 0} วา
                                    </td>
                                    <td className="p-2.5 text-gray-600">
                                      {it.width && it.length ? `${it.width} × ${it.length} ม.` : "-"}
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 border rounded-xl text-gray-500 text-center">
                        ไม่มีรายการ Batch เฉพาะเจาะจง (ส่งรายงานผลทั่วไป)
                      </div>
                    )}
                  </div>

                  {/* Feedback Field for Rejection */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      ข้อเสนอแนะให้แก้ไข (กรณีส่งกลับให้ลูกน้องแก้ไข)
                    </label>
                    <textarea
                      rows={2}
                      value={reviewFeedback}
                      onChange={(e) => setReviewFeedback(e.target.value)}
                      placeholder="ระบุจุดที่ต้องแก้ไข เช่น ขนาดพื้นที่ไม่ตรง หรือ ขอให้ถ่ายรูปใหม่อีกครั้ง..."
                      className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>

                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 leading-relaxed">
                    ℹ️ <strong>เงื่อนไขการอนุมัติ:</strong> เมื่อท่านกด "อนุมัติ" ข้อมูลทรัพย์สินทั้งหมดด้านบนจะถูกบันทึกลงสู่ฐานข้อมูลจริงของระบบ AMS ทันที และจะไปปรากฏที่หน้าจอของพนักงานบัญชีโดยอัตโนมัติ
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setReviewModalOpen(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
                    >
                      ปิดหน้าต่าง
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isReviewing}
                        onClick={() => handleReviewAction("reject")}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition disabled:opacity-50"
                      >
                        ✕ ส่งกลับให้แก้ไข
                      </button>
                      <button
                        type="button"
                        disabled={isReviewing}
                        onClick={() => handleReviewAction("approve")}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1"
                      >
                        <CheckCircle2 size={14} />
                        <span>✓ อนุมัติข้อมูล (Commit DB)</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Member Active Tasks & Work History Modal */}
      {memberTasksModal.isOpen && memberTasksModal.member && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-govblue-800 to-govblue-900 text-white flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center text-base font-bold shrink-0">
                  {(memberTasksModal.member.subordinate_name || memberTasksModal.member.subordinate_username || "U")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold truncate">
                    {memberTasksModal.member.subordinate_name || memberTasksModal.member.subordinate_username}
                  </h3>
                  <div className="text-xs text-govblue-200">
                    @{memberTasksModal.member.subordinate_username} • {t("เจ้าหน้าที่สำรวจภาคสนามในสังกัด", "Survey Officer in Team")}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMemberTasksModal({ isOpen: false, member: null, mode: "active" })}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Mode Tabs */}
            {(() => {
              const m = memberTasksModal.member;
              const userDetail = (Array.isArray(users) ? users : []).find(
                (u) =>
                  u.public_id === m.subordinate_public_id ||
                  u.username === m.subordinate_username
              );
              const memberTasks = (Array.isArray(tasks) ? tasks : []).filter(
                (t) =>
                  t &&
                  (t.assignee_public_id === m.subordinate_public_id ||
                    (userDetail && t.assignee_public_id === userDetail.public_id))
              );
              const activeTasks = memberTasks.filter((t) =>
                ["pending", "accepted", "in_progress", "submitted"].includes(t.status)
              );
              const historyTasks = memberTasks.filter((t) =>
                ["done", "cancelled"].includes(t.status)
              );
              const currentList = memberTasksModal.mode === "active" ? activeTasks : historyTasks;

              return (
                <>
                  <div className="px-6 pt-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setMemberTasksModal((prev) => ({ ...prev, mode: "active" }))
                        }
                        className={`px-3.5 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                          memberTasksModal.mode === "active"
                            ? "border-govblue-600 text-govblue-800 bg-white rounded-t-lg"
                            : "border-transparent text-gray-500 hover:text-gray-800"
                        }`}
                      >
                        <Briefcase size={14} className={memberTasksModal.mode === "active" ? "text-govblue-600" : "text-gray-400"} />
                        <span>{t("งานที่กำลังทำอยู่", "Active Tasks")}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {activeTasks.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setMemberTasksModal((prev) => ({ ...prev, mode: "history" }))
                        }
                        className={`px-3.5 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                          memberTasksModal.mode === "history"
                            ? "border-govblue-600 text-govblue-800 bg-white rounded-t-lg"
                            : "border-transparent text-gray-500 hover:text-gray-800"
                        }`}
                      >
                        <History size={14} className={memberTasksModal.mode === "history" ? "text-govblue-600" : "text-gray-400"} />
                        <span>{t("ประวัติการทำงาน", "Work History")}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700">
                          {historyTasks.length}
                        </span>
                      </button>
                    </div>

                    <Link
                      href={`/tasks/new?assignee=${encodeURIComponent(m.subordinate_public_id)}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-govblue-700 hover:text-govblue-800 transition"
                      onClick={() => setMemberTasksModal({ isOpen: false, member: null, mode: "active" })}
                    >
                      <Plus size={13} className="stroke-[2.5]" />
                      <span>{t("สั่งงานใหม่ให้คนนี้", "Assign Task")}</span>
                    </Link>
                  </div>

                  {/* Task List */}
                  <div className="p-6 overflow-y-auto space-y-3 flex-1">
                    {currentList.length === 0 ? (
                      <div className="py-12 text-center text-gray-400">
                        {memberTasksModal.mode === "active" ? (
                          <>
                            <Briefcase size={36} className="mx-auto text-gray-300 mb-2" />
                            <p className="text-sm font-medium text-gray-700">ไม่มีงานที่กำลังปฏิบัติงานอยู่ในขณะนี้</p>
                            <p className="text-xs text-gray-400 mt-1">สามารถกดปุ่ม "+ สั่งงานใหม่ให้คนนี้" ด้านบนเพื่อมอบหมายงาน</p>
                          </>
                        ) : (
                          <>
                            <History size={36} className="mx-auto text-gray-300 mb-2" />
                            <p className="text-sm font-medium text-gray-700">ยังไม่มีประวัติงานที่เสร็จสิ้น</p>
                            <p className="text-xs text-gray-400 mt-1">เมื่องานได้รับการอนุมัติเสร็จสิ้นจะแสดงประวัติที่นี่</p>
                          </>
                        )}
                      </div>
                    ) : (
                      currentList.map((task) => (
                        <div
                          key={task.public_id}
                          className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs hover:border-govblue-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {task.code && (
                                <span className="font-mono text-xs font-bold text-govblue-700 bg-govblue-50 px-2 py-0.5 rounded">
                                  {task.code}
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  task.status === "done"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : task.status === "in_progress"
                                    ? "bg-sky-100 text-sky-800"
                                    : task.status === "submitted"
                                    ? "bg-purple-100 text-purple-800"
                                    : task.status === "accepted"
                                    ? "bg-blue-100 text-blue-800"
                                    : task.status === "cancelled"
                                    ? "bg-gray-100 text-gray-600"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {STATUS_LABEL[task.status] || task.status}
                              </span>
                              {task.task_type && (
                                <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                  {TYPE_LABEL[task.task_type] || task.task_type}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-gray-900 truncate">
                              {task.title}
                            </h4>
                            {(task.place_name || task.due_at) && (
                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                                {task.place_name && (
                                  <span className="flex items-center gap-1 truncate max-w-xs">
                                    <MapPin size={12} className="text-gray-400 shrink-0" />
                                    {task.place_name}
                                  </span>
                                )}
                                {task.due_at && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} className="text-gray-400" />
                                    กำหนดส่ง: {task.due_at.slice(0, 10)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setMemberTasksModal({ isOpen: false, member: null, mode: "active" });
                                setSelectedTask(task);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-govblue-50 text-govblue-800 hover:bg-govblue-100 border border-govblue-200 transition"
                            >
                              <ExternalLink size={13} />
                              <span>ดูรายละเอียดงาน</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setMemberTasksModal({ isOpen: false, member: null, mode: "active" })}
                      className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
                    >
                      {t("ปิดหน้าต่าง", "Close")}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 5. Photo Lightbox Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-700 flex flex-col max-h-[92vh]">
            <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between">
              <span className="text-xs font-bold truncate flex items-center gap-1.5">
                <Camera size={14} className="text-govgold-400" />
                <span>{previewPhoto.caption || previewPhoto.name}</span>
              </span>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-2 flex-1 flex items-center justify-center overflow-hidden bg-black/90">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
            {previewPhoto.caption && (
              <div className="px-4 py-2.5 bg-slate-800 text-xs text-slate-200 text-center border-t border-slate-700">
                {previewPhoto.caption}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Custom Confirmation & Alert Dialog */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        tone={confirmDialog.tone}
        isLoading={confirmDialog.isLoading}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.cancelLabel ? confirmDialog.onCancel : undefined}
      />
    </Page>
  );
}
