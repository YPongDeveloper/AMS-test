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
} from "lucide-react";

// 4 ขั้นตอนหลักของ Workflow ภารกิจสำรวจ
const PIPELINE_STEPS: { status: TaskStatus; label: string; sub: string }[] = [
  { status: "pending", label: "รอรับงาน", sub: "มอบหมายแล้ว" },
  { status: "accepted", label: "รับงานแล้ว", sub: "ยืนยันการรับ" },
  { status: "in_progress", label: "กำลังปฏิบัติงาน", sub: "ลงพื้นที่สำรวจ" },
  { status: "done", label: "เสร็จสิ้น", sub: "ส่งมอบงานสมบูรณ์" },
];

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getTaskDateStr = (task: Task) => {
  const dt = task.due_at || task.created_at;
  if (!dt) return "";
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

const DEFAULT_SAMPLE_TASKS: Task[] = [
  {
    public_id: "sample-tk-1",
    code: "TK-2569-001",
    title: "สำรวจรังวัดแนวเขตแปลงที่ดิน ย่านสถานีรถไฟอยุธยา",
    task_type: "survey",
    description:
      "ตรวจสอบแนวเขตกรรมสิทธิ์ที่ดิน รฟท. และบันทึกพิกัด GPS พร้อมขนาด ไร่-งาน-ตารางวา เพื่อนำข้อมูลเข้าสู่ระบบบริหารจัดการทรัพย์สิน รฟท. ตามมาตรฐานปี 2569 พร้อมทั้งตรวจสอบหลักหมุดที่ดินว่ามีสภาพสมบูรณ์หรือไม่",
    status: "in_progress",
    assignee_public_id: "usr-normal",
    assignee_name: "เจ้าหน้าที่สำรวจ",
    assigner_public_id: "usr-leader",
    assigner_name: "หัวหน้างานสำรวจ",
    due_at: new Date().toISOString(),
    lat: 14.3532,
    lng: 100.5828,
    place_name: "สถานีรถไฟอยุธยา (ย่านสินค้า)",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    public_id: "sample-tk-2",
    code: "TK-2569-002",
    title: "ตรวจสอบสภาพอาคารสิ่งปลูกสร้าง ย่านบางซื่อ",
    task_type: "inspect",
    description:
      "ถ่ายรูป 4 ทิศ และตรวจนับจำนวนชั้น ขนาดพื้นที่ เพื่อบันทึกเข้าสู่ระบบ AMS รฟท. รวมถึงประเมินสภาพความมั่นคงแข็งแรงของตัวโครงสร้าง และตรวจสอบการขอใช้พื้นที่ของผู้เช่า",
    status: "pending",
    assignee_public_id: "usr-normal",
    assignee_name: "เจ้าหน้าที่สำรวจ",
    assigner_public_id: "usr-leader",
    assigner_name: "หัวหน้างานสำรวจ",
    due_at: new Date().toISOString(),
    lat: 13.8045,
    lng: 100.5398,
    place_name: "สถานีกลางกรุงเทพอภิวัฒน์ / ย่านพหลโยธิน",
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    public_id: "sample-tk-3",
    code: "TK-2569-003",
    title: "ตรวจสอบอาคารพาณิชย์ให้เช่า สถานีรถไฟดอนเมือง",
    task_type: "inspect",
    description:
      "ตรวจสอบสัญญาเช่าและพื้นที่ใช้สอยจริงของร้านค้าและอาคารพาณิชย์บริเวณแนวเขตสถานีรถไฟดอนเมือง",
    status: "pending",
    assignee_public_id: "usr-normal",
    assignee_name: "เจ้าหน้าที่สำรวจ",
    assigner_public_id: "usr-leader",
    assigner_name: "หัวหน้างานสำรวจ",
    due_at: new Date().toISOString(),
    lat: 13.913,
    lng: 100.598,
    place_name: "สถานีรถไฟดอนเมือง (แนวเขต รฟท.)",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    public_id: "sample-tk-4",
    code: "TK-2569-004",
    title: "รังวัดหมุดหลักเขตแนวทางรถไฟ ย่านมักกะสัน",
    task_type: "survey",
    description:
      "ตรวจสภาพหลักหมุดคอนกรีตและรังวัดพิกัดดาวเทียม GNSS แปลงที่ดินโรงงานมักกะสัน",
    status: "done",
    assignee_public_id: "usr-normal",
    assignee_name: "เจ้าหน้าที่สำรวจ",
    assigner_public_id: "usr-leader",
    assigner_name: "หัวหน้างานสำรวจ",
    due_at: new Date().toISOString(),
    lat: 13.7505,
    lng: 100.5515,
    place_name: "โรงงานรถไฟมักกะสัน",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    public_id: "sample-tk-5",
    code: "TK-2569-005",
    title: "สำรวจพื้นที่ทับซ้อนแนวเขต ย่านยมราช",
    task_type: "survey",
    description: "งานสำรวจยกเลิกเนื่องจากมีการปรับปรุงแผนงานร่วมกับหน่วยงานภายนอก",
    status: "cancelled",
    assignee_public_id: "usr-normal",
    assignee_name: "เจ้าหน้าที่สำรวจ",
    assigner_public_id: "usr-leader",
    assigner_name: "หัวหน้างานสำรวจ",
    due_at: new Date().toISOString(),
    lat: 13.757,
    lng: 100.521,
    place_name: "จุดตัดทางรถไฟยมราช",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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

  // อัปเดตแท็บเริ่มต้นตามบทบาทเมื่อ me โหลดเสร็จ
  useEffect(() => {
    if (me?.role === "subordinate") {
      setActiveTab("my_tasks");
    } else if (me?.role === "supervisor" || me?.role === "admin") {
      setActiveTab("assigned_by_me");
    }
  }, [me?.role]);

  const loadTasks = useCallback(async () => {
    try {
      const data = await api<Task[]>("/api/tasks");
      if (Array.isArray(data) && data.length > 0) {
        setTasks(data);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("ams_saved_tasks", JSON.stringify(data));
        }
        return;
      }
    } catch {
      /* ignore api error */
    }

    // Fallback เมื่อออฟไลน์หรือไม่มีข้อมูล
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem("ams_saved_tasks");
      if (cached) {
        try {
          setTasks(JSON.parse(cached));
          return;
        } catch {
          /* ignore parse error */
        }
      }
      setTasks(DEFAULT_SAMPLE_TASKS);
      window.localStorage.setItem("ams_saved_tasks", JSON.stringify(DEFAULT_SAMPLE_TASKS));
    }
  }, []);

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
    if (isSup) loadUsers();

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
          window.localStorage.setItem("ams_saved_tasks", JSON.stringify(next));
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
        return 2;
      case "done":
        return 3;
      default:
        return -1;
    }
  };

  return (
    <Page>
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
              <Link
                href="/tasks/new"
                className="inline-flex items-center justify-center gap-2 bg-govblue-700 hover:bg-govblue-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition self-start sm:self-auto"
              >
                <Plus size={18} /> {t("สั่งงานใหม่", "New Task")}
              </Link>
            )}
          </div>

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
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white text-center py-14 px-4 text-gray-500 shadow-xs">
                      <ClipboardList size={36} className="mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-700">
                        {activeTab === "assigned_by_me"
                          ? t("ยังไม่มีงานที่คุณสั่ง — กดปุ่ม “+ สั่งงานใหม่” เพื่อเริ่มต้น", "No tasks assigned by you yet")
                          : t("ยังไม่มีงานที่ได้รับมอบหมาย", "No assigned tasks yet")}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        งานที่สั่งจะได้รับการอัปเดตและแจ้งเตือนทันทีแบบ Real-time
                      </p>
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
                                    <option value="done">เสร็จสิ้น</option>
                                    <option value="cancelled">ยกเลิก</option>
                                  </select>
                                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 text-current" />
                                </div>
                              </div>

                              {/* View Details button */}
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
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="px-5 py-2 bg-govblue-800 hover:bg-govblue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
