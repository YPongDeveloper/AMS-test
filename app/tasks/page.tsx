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
import TasksMasterMap from "@/components/TasksMasterMap";
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
  RotateCcw,
} from "lucide-react";

// 5 ขั้นตอนหลักของ Workflow ภารกิจสำรวจและส่งมอบงาน
const PIPELINE_STEPS: { status: TaskStatus; label: string; sub: string }[] = [
  { status: "pending", label: "รอรับงาน", sub: "มอบหมายแล้ว" },
  { status: "accepted", label: "รับงานแล้ว", sub: "ยืนยันการรับ" },
  { status: "in_progress", label: "กำลังปฏิบัติงาน", sub: "ลงพื้นที่สำรวจ" },
  { status: "submitted", label: "ส่งตรวจแล้ว", sub: "รอหัวหน้าอนุมัติ" },
  { status: "done", label: "เสร็จสิ้น", sub: "อนุมัติเข้าระบบแล้ว" },
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

const getTaskDateStr = (task: Task) => {
  const dt = task.due_at || task.created_at;
  if (!dt) return "";
  const m = String(dt).match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  try {
    const d = new Date(dt);
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
        "ตรวจสอบแนวเขตกรรมสิทธิ์ที่ดิน รฟท. และบันทึกพิกัด GPS พร้อมขนาด ไร่-งาน-ตารางวา เพื่อนำข้อมูลเข้าสู่ระบบบริหารจัดการทรัพย์สิน รฟท. ตามมาตรฐานปี 2569 พร้อมทั้งตรวจสอบหลักหมุดคอนกรีตว่ามีสภาพสมบูรณ์หรือไม่",
      status: "in_progress",
      assignee_public_id: "usr-normal",
      assignee_name: "เจ้าหน้าที่สำรวจ",
      assigner_public_id: "usr-leader",
      assigner_name: "หัวหน้างานสำรวจ",
      due_at: `${today}T16:30:00`,
      lat: 14.3532,
      lng: 100.5828,
      place_name: "สถานีรถไฟอยุธยา (ย่านสินค้า รฟท.)",
      created_at: `${today}T08:30:00`,
      updated_at: `${today}T09:15:00`,
    },
    {
      public_id: "tk-mock-02",
      code: "TK-2569-002",
      title: "ตรวจสอบสภาพอาคารสิ่งปลูกสร้าง ย่านกลางบางซื่อ",
      task_type: "inspect",
      description:
        "ถ่ายรูป 4 ทิศ และตรวจนับจำนวนชั้น ขนาดพื้นที่ เพื่อบันทึกเข้าสู่ระบบ AMS รฟท. รวมถึงประเมินสภาพความมั่นคงแข็งแรงของตัวโครงสร้าง และตรวจสอบการขอใช้พื้นที่ของผู้เช่า",
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
      description:
        "ตรวจสอบการอนุรักษ์อาคารสถาปัตยกรรมประวัติศาสตร์ และสำรวจพื้นที่เช่าบริการเชิงพาณิชย์ภายในโถงสถานีรถไฟกรุงเทพ",
      status: "in_progress",
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
        "ตรวจวัดขนาดพื้นที่เช่าแผงค้าและร้านอาหารริมทางรถไฟ เปรียบเทียบกับแบบแปลนสัญญาเช่า รฟท. บันทึกผลตรวจเรียบร้อย",
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
        "สำรวจรังวัดแนวเขตที่ดินติดริมคลองบางกอกน้อย ตรวจสอบหลักเขตและแนวเขื่อนกันดินของ รฟท. พร้อมบันทึกภาพถ่ายสภาพพื้นที่",
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
        "ตรวจเช็กสภาพอาคารบ้านพักสวัสดิการพนักงาน รฟท. สำรวจความชำรุดเสียหายเพื่อเสนอของบประมาณซ่อมบำรุงประจำปี",
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

  // 1. Team Management State (Supervisor)
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [myTeam, setMyTeam] = useState<TeamMember[]>([]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviting, setInviting] = useState(false);

  // 2. Subordinate Invitation Alerts
  const [myInvitations, setMyInvitations] = useState<TeamMember[]>([]);

  // 3. Accountant Requests State (Supervisor)
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [revisionRequests, setRevisionRequests] = useState<RevisionRequest[]>([]);

  // 4. Subordinate Data Submission Modal
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [submittingTask, setSubmittingTask] = useState<Task | null>(null);
  const [batchItems, setBatchItems] = useState<any[]>([]);
  const [submissionSummary, setSubmissionSummary] = useState("");
  const [submittingData, setSubmittingData] = useState(false);

  // 5. Supervisor Review Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingTask, setReviewingTask] = useState<Task | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);

  const loadTeam = useCallback(async () => {
    try {
      const data = await fetchMyTeam();
      setMyTeam(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    try {
      const data = await fetchMyInvitations();
      setMyInvitations(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadRevisionRequests = useCallback(async () => {
    try {
      const data = await fetchRevisionRequests();
      setRevisionRequests(data);
    } catch {
      /* ignore */
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
      alert(err.message || "เกิดข้อผิดพลาดในการส่งคำเชิญ");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (id: string, name: string) => {
    if (!confirm(`ยืนยันการนำคุณ "${name}" ออกจากทีมใช่หรือไม่?`)) return;
    try {
      await removeTeamMember(id);
      setNotice(`นำสมาชิกออกจากทีมเรียบร้อย`);
      await loadTeam();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  };

  const handleRespondInvitation = async (id: string, action: "accepted" | "declined") => {
    try {
      await respondToInvitation(id, action);
      setNotice(action === "accepted" ? "ยินดีต้อนรับ! ท่านได้เข้าร่วมทีมสำรวจแล้ว" : "ปฏิเสธคำเชิญเข้าร่วมทีมแล้ว");
      await loadInvitations();
      await loadTasks();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  };

  const openSubmissionModal = (task: Task) => {
    setSubmittingTask(task);
    setSubmissionSummary("");
    if (task.target_type === "building") {
      setBatchItems([
        {
          bldg_code: `BL-${new Date().getFullYear() + 543}-${String(Math.floor(Math.random() * 900) + 100)}`,
          name: "",
          land_code: "",
          material_type: "คอนกรีตเสริมเหล็ก",
          num_fl: 2,
          bld_condition_type: "ดี",
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
        },
      ]);
    }
    setSubmissionModalOpen(true);
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

  const handleSubmitTaskData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingTask) return;
    setSubmittingData(true);
    try {
      const isBldg = submittingTask.target_type === "building";
      await submitTaskData(submittingTask.public_id, {
        summary: submissionSummary.trim() || undefined,
        items: batchItems,
        lands: !isBldg ? (batchItems as any) : undefined,
        buildings: isBldg ? (batchItems as any) : undefined,
      });
      setSubmissionModalOpen(false);
      setNotice(`ส่งข้อมูลงาน "${submittingTask.title}" ให้หัวหน้างานตรวจสอบเรียบร้อยแล้ว`);
      await loadTasks();
      if (selectedTask?.public_id === submittingTask.public_id) {
        setSelectedTask(null);
      }
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการส่งข้อมูล");
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
      alert("กรุณาระบุข้อเสนอแนะหรือสิ่งที่ต้องการให้ลูกน้องแก้ไข");
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
      alert(err.message || "เกิดข้อผิดพลาดในการตรวจสอบงาน");
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
          const hasToday = Array.isArray(parsed) && parsed.some((t: Task) => getTaskDateStr(t) === todayStr);
          if (hasToday && parsed.length >= 8) {
            setTasks(parsed);
            return;
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
      setUsers(await api<AppUser[]>("/api/users"));
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
      alert((e as Error).message);
    }
  }

  // คัดกรองงานตามแท็บที่เลือก
  const currentTabTasks = useMemo(() => {
    return tasks.filter((task) => {
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
      if (!filterByDate) return true;
      const tDate = getTaskDateStr(task);
      return tDate === selectedDate;
    });
  }, [currentTabTasks, filterByDate, selectedDate]);

  // คัดกรองงานตามสถานะที่เลือกจากปุ่ม Filter Cards
  const displayedTasks = useMemo(() => {
    return dateFilteredTasks.filter((task) => {
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
    pending: baseForStats.filter((t) => t.status === "pending").length,
    inProgress: baseForStats.filter((t) => t.status === "in_progress" || t.status === "accepted").length,
    done: baseForStats.filter((t) => t.status === "done").length,
    cancelled: baseForStats.filter((t) => t.status === "cancelled").length,
  }), [baseForStats]);

  // อัปเดต orderedTaskIds เริ่มต้นเมื่อ dateFilteredTasks เปลี่ยน
  useEffect(() => {
    const ids = dateFilteredTasks.map((t) => t.public_id);
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
                    ? t("Real-time ออนไลน์", "Realtime connected")
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
                  {revisionRequests.filter((r) => r.status === "pending").length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {revisionRequests.filter((r) => r.status === "pending").length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setTeamModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-govblue-50 text-govblue-800 border border-gray-300 text-xs sm:text-sm font-semibold px-3 py-2 rounded-lg shadow-xs transition"
                >
                  <Users size={16} className="text-govblue-600" />
                  <span>จัดการทีม</span>
                  {myTeam.filter((m) => m.status === "accepted").length > 0 && (
                    <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
                      {myTeam.filter((m) => m.status === "accepted").length}
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
          {!isSup && myInvitations.length > 0 && (
            <div className="space-y-2 mb-2 animate-in fade-in">
              {myInvitations.map((inv) => (
                <div
                  key={inv.id}
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
              ))}
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
                      {tasks.filter((t) => t.assigner_public_id === me.public_id || isSup).length}
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
                    {t("สมาชิกในสังกัด", "Team Members")}
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

                {/* Toggle All Days vs Specific Day */}
                <button
                  type="button"
                  onClick={() => setFilterByDate(!filterByDate)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${
                    !filterByDate
                      ? "bg-amber-50 border-amber-300 text-amber-800 font-semibold"
                      : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {!filterByDate ? t("แสดงทุกวัน (ไม่จำกัด)", "Showing All Days") : t("แสดงงานทุกวัน", "Show All Days")}
                </button>

                {/* Reload Sample Tasks Button */}
                <button
                  type="button"
                  onClick={handleReloadSampleTasks}
                  title="โหลดข้อมูลตัวอย่างงานวันนี้ใหม่ (14 งาน)"
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-govblue-200 bg-govblue-50/80 hover:bg-govblue-100 text-govblue-800 font-medium transition flex items-center gap-1 shadow-2xs"
                >
                  <RotateCcw size={13} className="text-govblue-700" />
                  <span>{t("โหลดตัวอย่างวันนี้", "Load Sample Today")}</span>
                </button>

                {filterByDate && (
                  <span className="text-[11px] text-gray-500 hidden lg:inline ml-1 font-medium">
                    ({formatThaiDate(selectedDate)})
                  </span>
                )}
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
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              <div className="p-4 bg-govblue-50/50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-govblue-900">
                  รายชื่อบุคลากรและเจ้าหน้าที่ในสังกัด
                </h3>
                <p className="text-xs text-gray-500">
                  จัดการสิทธิ์ของสมาชิกเพื่อมอบหมายงานสำรวจภาคสนาม
                </p>
              </div>
              {users.map((u) => (
                <div key={u.public_id} className="flex items-center gap-3 px-4 py-3.5">
                  {u.picture_url ? (
                    <img
                      src={u.picture_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-gray-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-govblue-100 text-govblue-700 flex items-center justify-center text-sm font-bold">
                      {u.display_name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-800 truncate">
                      {u.display_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {u.username ? `@${u.username}` : "ผู้ใช้งานในระบบ"}
                    </div>
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.public_id, e.target.value)}
                    className="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-govblue-500/20"
                  >
                    <option value="subordinate">{t("เจ้าหน้าที่สำรวจ (ลูกน้อง)", "Subordinate")}</option>
                    <option value="supervisor">{t("หัวหน้างาน (สั่งงานได้)", "Supervisor")}</option>
                    <option value="admin">{t("ผู้ดูแลระบบ (Admin)", "Administrator")}</option>
                  </select>
                </div>
              ))}
              {users.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  {t("ยังไม่มีสมาชิกในระบบ", "No members yet")}
                </div>
              )}
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
                        งานที่สั่งจะได้รับการอัปเดตและแจ้งเตือนทันทีแบบ Real-time
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
                                      STATUS_COLOR[task.status]
                                    }`}
                                  >
                                    {STATUS_LABEL[task.status]}
                                  </span>
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {TYPE_LABEL[task.task_type] || task.task_type}
                                  </span>
                                </div>

                                {task.due_at && (
                                  <div className="text-xs text-gray-500 font-mono flex items-center gap-1 shrink-0">
                                    <Calendar size={12} className="text-gray-400" />
                                    <span>{fmtDateTime(task.due_at).split(" ")[0]}</span>
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
                      STATUS_COLOR[selectedTask.status]
                    }`}
                  >
                    {STATUS_LABEL[selectedTask.status]}
                  </span>
                  <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-blue-100 border border-white/10">
                    {TYPE_LABEL[selectedTask.task_type] || selectedTask.task_type}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white leading-snug break-words">
                  {selectedTask.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/15 transition shrink-0"
                title="ปิดหน้าต่าง"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-gray-800">
              {/* Modern Workflow Pipeline Stepper */}
              <div className="bg-gradient-to-r from-govblue-50/60 via-white to-govblue-50/60 p-4 rounded-xl border border-govblue-100 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-govblue-900 tracking-wide uppercase flex items-center gap-1.5">
                    <Activity size={14} className="text-govblue-700" />
                    ขั้นตอนการดำเนินงาน (Workflow Pipeline)
                  </span>
                  {selectedTask.status === "cancelled" ? (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                      ยกเลิกงานนี้แล้ว
                    </span>
                  ) : (
                    <span className="text-[11px] text-govblue-600 font-medium">
                      คลิกที่ขั้นตอนเพื่อเปลี่ยนสถานะ
                    </span>
                  )}
                </div>

                {/* 4 Pipeline Steps */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PIPELINE_STEPS.map((step, idx) => {
                    const isCurrent = selectedTask.status === step.status;
                    const stepIdx = getStepIndex(selectedTask.status);
                    const isPassed = stepIdx > idx && selectedTask.status !== "cancelled";

                    return (
                      <button
                        key={step.status}
                        type="button"
                        onClick={() => {
                          setStatus(selectedTask, step.status);
                          setSelectedTask({ ...selectedTask, status: step.status });
                        }}
                        className={`relative flex flex-col items-center p-3 rounded-xl border transition-all text-center group ${
                          isCurrent
                            ? "bg-govblue-800 text-white border-govblue-800 shadow-md ring-2 ring-govblue-600/30 scale-[1.02]"
                            : isPassed
                            ? "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100/70"
                            : "bg-white text-gray-600 border-gray-200 hover:border-govblue-300 hover:bg-gray-50"
                        }`}
                      >
                        {/* Step Number / Check Icon */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition ${
                            isCurrent
                              ? "bg-govgold-500 text-govblue-900 shadow-xs"
                              : isPassed
                              ? "bg-emerald-500 text-white"
                              : "bg-gray-100 text-gray-500 group-hover:bg-govblue-50 group-hover:text-govblue-700"
                          }`}
                        >
                          {isPassed ? <Check size={14} /> : idx + 1}
                        </div>

                        {/* Step Label */}
                        <span className={`text-xs font-semibold leading-tight ${isCurrent ? "text-white" : ""}`}>
                          {step.label}
                        </span>
                        <span
                          className={`text-[10px] mt-0.5 ${
                            isCurrent ? "text-blue-200" : isPassed ? "text-emerald-600" : "text-gray-400"
                          }`}
                        >
                          {step.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Status Bar & Cancel Option */}
                <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">สถานะปัจจุบัน:</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[selectedTask.status]}`}>
                      {STATUS_LABEL[selectedTask.status]}
                    </span>
                  </div>

                  <div>
                    {selectedTask.status !== "cancelled" ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("ต้องการเปลี่ยนสถานะเป็น 'ยกเลิก' ใช่หรือไม่?")) {
                            setStatus(selectedTask, "cancelled");
                            setSelectedTask({ ...selectedTask, status: "cancelled" });
                          }
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 hover:underline font-medium"
                      >
                        ยกเลิกงานนี้
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setStatus(selectedTask, "pending");
                          setSelectedTask({ ...selectedTask, status: "pending" });
                        }}
                        className="text-xs text-govblue-700 hover:text-govblue-900 hover:underline font-medium"
                      >
                        กู้คืนสถานะกลับมา
                      </button>
                    )}
                  </div>
                </div>
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
              {selectedTask.submission_data && (
                <div className="p-4 bg-slate-50 border border-gray-200 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-gray-800 flex items-center justify-between">
                    <span>ข้อมูลที่บันทึกส่งมอบ (Submission Data):</span>
                    {selectedTask.target_type && (
                      <span className="text-[11px] font-medium text-govblue-700 bg-govblue-50 px-2 py-0.5 rounded">
                        {selectedTask.target_type === "land" ? "ข้อมูลแปลงที่ดิน" : "ข้อมูลสิ่งปลูกสร้าง"}
                      </span>
                    )}
                  </div>
                  {selectedTask.submission_data.summary && (
                    <p className="text-gray-600 italic">"{selectedTask.submission_data.summary}"</p>
                  )}
                  {Array.isArray(selectedTask.submission_data.items) && selectedTask.submission_data.items.length > 0 && (
                    <div className="text-[11px] text-gray-500 font-medium">
                      รวมทั้งหมด {selectedTask.submission_data.items.length} รายการ
                    </div>
                  )}
                </div>
              )}

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

              {/* Location & Map Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-govblue-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <MapPin size={14} className="text-rose-500" /> สถานที่และพิกัดภูมิศาสตร์
                  </h4>
                  {selectedTask.lat != null && selectedTask.lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${selectedTask.lat},${selectedTask.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-govblue-700 hover:text-govblue-900 hover:underline flex items-center gap-1 font-medium"
                    >
                      เปิดดูใน Google Maps <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {selectedTask.place_name && (
                  <div className="text-xs text-gray-700 mb-2.5 font-medium bg-rose-50/60 border border-rose-200 px-3 py-2 rounded-lg flex items-center gap-2">
                    <MapPin size={14} className="text-rose-500 shrink-0" />
                    <span>{selectedTask.place_name}</span>
                  </div>
                )}

                {selectedTask.lat != null && selectedTask.lng != null ? (
                  <div className="rounded-xl overflow-hidden border border-gray-300 shadow-xs">
                    <MapPicker
                      lat={selectedTask.lat}
                      lng={selectedTask.lng}
                      height="220px"
                      showInputs={false}
                      readOnly={true}
                    />
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
                onClick={() => setSelectedTask(null)}
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
            <div>
              <div className="text-xs font-bold text-gray-800 mb-2 flex items-center justify-between">
                <span>รายชื่อสมาชิกในทีมของคุณ</span>
                <span className="text-gray-400 font-normal">({myTeam.length} คน)</span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {myTeam.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                    ยังไม่มีสมาชิกในทีม เชิญพนักงานสำรวจโดยกรอกชื่อผู้ใช้งานด้านบน
                  </div>
                ) : (
                  myTeam.map((m) => (
                    <div
                      key={m.id}
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
                          onClick={() => handleRemoveMember(m.subordinate_public_id, m.subordinate_name || m.subordinate_username || "")}
                          className="text-gray-400 hover:text-rose-600 p-1"
                          title="นำออกจากทีม"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

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
              ฝ่ายบัญชีได้สร้างคำร้องขอให้ตรวจสอบหรือแก้ไขข้อมูล ท่านสามารถสั่งงานต่อให้ลูกน้องในทีมลงพื้นที่หรือแก้ไขข้อมูลได้ทันที
            </p>

            <div className="max-h-96 overflow-y-auto space-y-3">
              {revisionRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                  ยังไม่มีคำร้องจากฝ่ายบัญชีในขณะนี้
                </div>
              ) : (
                revisionRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs"
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

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setRequestsModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal กรอกและส่งข้อมูลผลงาน (Subordinate Data Submission Modal) */}
      {submissionModalOpen && submittingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100">
            <div className="px-6 py-4 bg-gradient-to-r from-govblue-800 to-govblue-700 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="text-xs text-blue-200">แบบฟอร์มส่งมอบผลงาน</div>
                <h3 className="text-base font-bold truncate">{submittingTask.title}</h3>
              </div>
              <button
                onClick={() => setSubmissionModalOpen(false)}
                className="text-blue-200 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitTaskData} className="p-6 space-y-4 overflow-y-auto flex-1">
              {submittingTask.status === "revision_requested" && submittingTask.supervisor_feedback && (
                <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-xl space-y-1 text-xs">
                  <div className="font-bold text-orange-900 flex items-center gap-1.5">
                    <AlertCircle size={15} className="text-orange-600" />
                    <span>หัวหน้างานส่งกลับให้แก้ไข:</span>
                  </div>
                  <p className="text-orange-800 whitespace-pre-wrap">{submittingTask.supervisor_feedback}</p>
                </div>
              )}

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
                              <label className="text-[10px] text-gray-500 block">ประเภท รฟท.</label>
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
                          </div>
                        </div>
                      ))}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  เมื่อกดส่ง ข้อมูลจะไปแสดงที่หัวหน้างานในสถานะ "ส่งตรวจแล้ว"
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSubmissionModalOpen(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submittingData}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    {submittingData ? "กำลังส่งข้อมูล..." : "ส่งให้หัวหน้าตรวจสอบ"}
                  </button>
                </div>
              </div>
            </form>
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
                                <th className="p-2.5">แปลงที่ดิน</th>
                                <th className="p-2.5">โครงสร้าง</th>
                                <th className="p-2.5">ชั้น</th>
                                <th className="p-2.5">สภาพ</th>
                              </tr>
                            ) : (
                              <tr>
                                <th className="p-2.5">รหัสที่ดิน</th>
                                <th className="p-2.5">เลขที่โฉนด</th>
                                <th className="p-2.5">ประเภท รฟท.</th>
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
                                    <td className="p-2.5 text-gray-600">{it.land_code || "-"}</td>
                                    <td className="p-2.5 text-gray-600">{it.material_type || "-"}</td>
                                    <td className="p-2.5">{it.num_fl || 1} ชั้น</td>
                                    <td className="p-2.5">{it.bld_condition_type || "ดี"}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-2.5 font-bold text-govblue-800">{it.land_code || "-"}</td>
                                    <td className="p-2.5 text-gray-700">{it.deed_no || "-"}</td>
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
    </Page>
  );
}
