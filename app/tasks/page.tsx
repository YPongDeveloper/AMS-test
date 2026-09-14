"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Eye,
  ChevronRight,
} from "lucide-react";

const STATUS_OPTIONS: { value: TaskStatus; label: string; tone: string }[] = [
  { value: "pending", label: "รอรับงาน", tone: "bg-amber-50 text-amber-800 border-amber-300" },
  { value: "accepted", label: "รับงานแล้ว", tone: "bg-sky-50 text-sky-800 border-sky-300" },
  { value: "in_progress", label: "กำลังปฏิบัติงาน", tone: "bg-indigo-50 text-indigo-800 border-indigo-300" },
  { value: "done", label: "เสร็จสิ้น", tone: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  { value: "cancelled", label: "ยกเลิก", tone: "bg-rose-50 text-rose-800 border-rose-300" },
];

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
    due_at: new Date(Date.now() + 86400000 * 2).toISOString(),
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
    due_at: new Date(Date.now() + 86400000 * 4).toISOString(),
    lat: 13.8045,
    lng: 100.5398,
    place_name: "สถานีกลางกรุงเทพอภิวัฒน์ / ย่านพหลโยธิน",
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
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
  const currentTabTasks = tasks.filter((task) => {
    if (activeTab === "assigned_by_me") {
      // งานที่ฉันสั่ง: ตรวจสอบว่าเป็นคนสั่งงานนี้
      return (
        task.assigner_public_id === me?.public_id ||
        task.assigner_name === me?.display_name ||
        isSup
      );
    }
    if (activeTab === "my_tasks") {
      // งานของฉัน: งานที่มอบหมายให้ฉัน
      return (
        task.assignee_public_id === me?.public_id ||
        task.assignee_name === me?.display_name ||
        !isSup
      );
    }
    return true; // all
  });

  // คัดกรองงานตามสถานะ
  const displayedTasks = currentTabTasks.filter((task) => {
    if (statusFilter === "all") return true;
    return task.status === statusFilter;
  });

  // สถิติยอดงาน
  const stats = {
    total: currentTabTasks.length,
    pending: currentTabTasks.filter((t) => t.status === "pending").length,
    inProgress: currentTabTasks.filter((t) => t.status === "in_progress" || t.status === "accepted").length,
    done: currentTabTasks.filter((t) => t.status === "done").length,
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
        <div className="max-w-5xl mx-auto space-y-5">
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
                  className={`inline-flex items-center gap-1 ${
                    wsOn ? "text-emerald-600" : "text-gray-400"
                  }`}
                >
                  <Radio size={12} className={wsOn ? "animate-pulse" : ""} />
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

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 shrink-0">
                <Layers size={20} />
              </div>
              <div>
                <div className="text-[11px] text-gray-500">{t("งานทั้งหมด", "Total")}</div>
                <div className="text-lg font-bold text-gray-900">{stats.total}</div>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <div className="text-[11px] text-amber-700 font-medium">{t("รอรับงาน", "Pending")}</div>
                <div className="text-lg font-bold text-amber-800">{stats.pending}</div>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <PlayCircle size={20} />
              </div>
              <div>
                <div className="text-[11px] text-indigo-700 font-medium">
                  {t("กำลังปฏิบัติงาน", "In Progress")}
                </div>
                <div className="text-lg font-bold text-indigo-800">{stats.inProgress}</div>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div className="text-[11px] text-emerald-700 font-medium">{t("เสร็จสิ้น", "Done")}</div>
                <div className="text-lg font-bold text-emerald-800">{stats.done}</div>
              </div>
            </div>
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
                <div className="flex items-center gap-1 text-sm font-semibold text-govblue-900 px-1 py-1">
                  <ClipboardList size={16} />
                  <span>{t("รายการงานที่ได้รับมอบหมาย", "Assigned Tasks List")}</span>
                </div>
              )}
            </div>

            {/* Filter by Status */}
            {activeTab !== "members" && (
              <div className="flex items-center gap-1.5 text-xs self-end sm:self-auto">
                <Filter size={14} className="text-gray-400" />
                <span className="text-gray-500 hidden sm:inline">{t("สถานะ:", "Status:")}</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | TaskStatus)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
                >
                  <option value="all">— ทุกสถานะ —</option>
                  <option value="pending">⏳ รอรับงาน</option>
                  <option value="accepted">📥 รับงานแล้ว</option>
                  <option value="in_progress">🚀 กำลังปฏิบัติงาน</option>
                  <option value="done">✅ เสร็จสิ้น</option>
                  <option value="cancelled">❌ ยกเลิก</option>
                </select>
              </div>
            )}
          </div>

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

          {/* Task Cards Grid (Fixed-size, 2-line truncated description) */}
          {activeTab !== "members" && (
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
                    return (
                      <div
                        key={task.public_id}
                        onClick={() => setSelectedTask(task)}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-govblue-400 transition-all flex flex-col justify-between p-4 cursor-pointer group relative overflow-hidden"
                      >
                        {/* Status accent bar on left */}
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                            task.status === "done"
                              ? "bg-emerald-500"
                              : task.status === "in_progress"
                              ? "bg-indigo-500"
                              : task.status === "accepted"
                              ? "bg-sky-500"
                              : task.status === "cancelled"
                              ? "bg-rose-500"
                              : "bg-amber-400"
                          }`}
                        />

                        <div className="pl-1">
                          {/* Card Header: Code, Type & Due Date */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-mono font-semibold text-govblue-800 bg-govblue-50 px-2 py-0.5 rounded border border-govblue-100">
                                {task.code || "TASK"}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                                {TYPE_LABEL[task.task_type] || task.task_type}
                              </span>
                            </div>

                            {task.due_at && (
                              <div className="text-[11px] text-gray-500 flex items-center gap-1 shrink-0 font-mono">
                                <Calendar size={12} className="text-gray-400" />
                                <span>{fmtDateTime(task.due_at).split(" ")[0]}</span>
                              </div>
                            )}
                          </div>

                          {/* Title: 1 line clamp */}
                          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-govblue-800 transition line-clamp-1 leading-snug">
                            {task.title}
                          </h3>

                          {/* Description: 2 lines clamp with ... */}
                          <p className="text-xs text-gray-500 line-clamp-2 mt-1 min-h-[2.5rem] leading-relaxed">
                            {task.description || "— ไม่ได้ระบุรายละเอียดงาน —"}
                          </p>

                          {/* Meta: Assigner, Assignee & Place */}
                          <div className="mt-2.5 pt-2.5 border-t border-gray-100 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                            <div className="truncate">
                              <span className="text-gray-400">สั่งโดย: </span>
                              <span className="font-medium text-gray-800">{task.assigner_name || "หัวหน้างาน"}</span>
                            </div>
                            <div className="truncate">
                              <span className="text-gray-400">ผู้รับ: </span>
                              <span className="font-medium text-govblue-800">{task.assignee_name || "เจ้าหน้าที่"}</span>
                            </div>
                            {task.place_name && (
                              <div className="col-span-2 flex items-center gap-1 text-[11px] text-gray-600 truncate">
                                <MapPin size={11} className="text-rose-500 shrink-0" />
                                <span className="truncate">{task.place_name}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: Status Selector & Details Button */}
                        <div
                          className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2 pl-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* สามารถเลือกสเตตัสการดำเนินการได้จาก Dropdown */}
                          <div className="flex items-center gap-1.5">
                            <select
                              value={task.status}
                              onChange={(e) => {
                                const newStatus = e.target.value as TaskStatus;
                                setStatus(task, newStatus);
                              }}
                              className={`text-[11px] font-semibold px-2 py-1 rounded-lg border focus:outline-none transition cursor-pointer ${
                                task.status === "done"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : task.status === "in_progress"
                                  ? "bg-indigo-50 text-indigo-800 border-indigo-300"
                                  : task.status === "accepted"
                                  ? "bg-sky-50 text-sky-800 border-sky-300"
                                  : task.status === "cancelled"
                                  ? "bg-rose-50 text-rose-800 border-rose-300"
                                  : "bg-amber-50 text-amber-800 border-amber-300"
                              }`}
                            >
                              <option value="pending">⏳ รอรับงาน</option>
                              <option value="accepted">📥 รับงานแล้ว</option>
                              <option value="in_progress">🚀 กำลังทำ</option>
                              <option value="done">✅ เสร็จสิ้น</option>
                              <option value="cancelled">❌ ยกเลิก</option>
                            </select>
                          </div>

                          {/* ปุ่มเปิดดูรายละเอียด */}
                          <button
                            type="button"
                            onClick={() => setSelectedTask(task)}
                            className="text-[11px] font-medium text-govblue-700 hover:text-govblue-900 flex items-center gap-1 bg-govblue-50/80 hover:bg-govblue-100 px-2.5 py-1 rounded-lg transition"
                          >
                            <span>ดูรายละเอียด</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal (หน้าต่างดูรายละเอียดงานฉบับเต็ม + แผนที่ + เลือกสเตตัส) */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-govblue-900 text-white flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-mono font-semibold bg-white/20 px-2.5 py-0.5 rounded text-govgold-300">
                    {selectedTask.code || "TASK"}
                  </span>
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                      STATUS_COLOR[selectedTask.status]
                    }`}
                  >
                    {STATUS_LABEL[selectedTask.status]}
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-white font-medium">
                    {TYPE_LABEL[selectedTask.task_type] || selectedTask.task_type}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-snug break-words">
                  {selectedTask.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-gray-800">
              {/* Status Changer Bar in Modal */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center justify-between">
                  <span>เลือกสถานะการดำเนินงาน (Status)</span>
                  <span className="text-[11px] font-normal text-gray-500">คลิกเพื่อเปลี่ยนสถานะ</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const active = selectedTask.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setStatus(selectedTask, opt.value);
                          setSelectedTask({ ...selectedTask, status: opt.value });
                        }}
                        className={`px-2 py-2 text-xs rounded-lg border text-center transition flex flex-col items-center justify-center gap-0.5 ${
                          active
                            ? "bg-govblue-800 text-white border-govblue-900 shadow-sm font-semibold"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <span className="text-sm">
                          {opt.value === "pending"
                            ? "⏳"
                            : opt.value === "accepted"
                            ? "📥"
                            : opt.value === "in_progress"
                            ? "🚀"
                            : opt.value === "done"
                            ? "✅"
                            : "❌"}
                        </span>
                        <span className="truncate text-[11px]">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Full Description */}
              <div>
                <h4 className="text-xs font-semibold text-govblue-900 mb-1.5">
                  รายละเอียดงาน (Description)
                </h4>
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selectedTask.description || "— ไม่มีการระบุรายละเอียดงาน —"}
                </div>
              </div>

              {/* Meta Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">ผู้สั่งมอบหมายงาน:</span>
                  <span className="font-semibold text-gray-800">
                    {selectedTask.assigner_name || "หัวหน้างาน"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">ผู้รับมอบหมายงาน:</span>
                  <span className="font-semibold text-govblue-800">
                    {selectedTask.assignee_name || "เจ้าหน้าที่สำรวจ"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">กำหนดส่งมอบงาน:</span>
                  <span className="font-medium text-gray-700">{fmtDateTime(selectedTask.due_at)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">วันที่สั่งงาน:</span>
                  <span className="font-medium text-gray-700">{fmtDateTime(selectedTask.created_at)}</span>
                </div>
              </div>

              {/* Location & Map Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-govblue-900 flex items-center gap-1.5">
                    <MapPin size={14} className="text-rose-500" /> สถานที่และพิกัดภูมิศาสตร์
                  </h4>
                  {selectedTask.lat != null && selectedTask.lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${selectedTask.lat},${selectedTask.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-govblue-700 hover:text-govblue-900 hover:underline flex items-center gap-1 font-medium"
                    >
                      เปิดดูใน Google Maps <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                {selectedTask.place_name && (
                  <div className="text-xs text-gray-700 mb-2 font-medium bg-rose-50/60 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <MapPin size={13} className="text-rose-500 shrink-0" />
                    <span>{selectedTask.place_name}</span>
                  </div>
                )}

                {selectedTask.lat != null && selectedTask.lng != null ? (
                  <div className="rounded-xl overflow-hidden border border-gray-300">
                    <MapPicker
                      lat={selectedTask.lat}
                      lng={selectedTask.lng}
                      onChange={() => {}}
                      height="200px"
                      showInputs={false}
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
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs text-gray-500">
                สถานะปัจจุบัน: <strong className="text-govblue-800">{STATUS_LABEL[selectedTask.status]}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 bg-govblue-800 hover:bg-govblue-900 text-white text-xs font-semibold rounded-lg shadow-sm transition"
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
