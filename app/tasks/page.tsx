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
import { ClipboardList, MapPin, Plus, Radio, Users } from "lucide-react";

const NEXT_STATUS: Partial<Record<TaskStatus, { to: TaskStatus; label: string }>> = {
  pending: { to: "accepted", label: "รับงาน" },
  accepted: { to: "in_progress", label: "เริ่มปฏิบัติงาน" },
  in_progress: { to: "done", label: "เสร็จสิ้นงาน" },
};

export default function TasksPage() {
  const { lang } = useI18n();
  const th = lang === "th";
  const { me, setMe, loading, needLogin, authing, signInWithLine } = useMe();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [notice, setNotice] = useState("");
  const [wsOn, setWsOn] = useState(false);
  const [err, setErr] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setTasks(await api<Task[]>("/api/tasks"));
    } catch {
      /* ignore */
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await api<AppUser[]>("/api/users"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    let mounted = true;
    loadTasks();
    if (me.role === "supervisor") loadUsers();
    const off = connectTaskWS(
      (e) => {
        if (!mounted) return;
        loadTasks();
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        if (e.type === "task.new") {
          setNotice(th ? `ได้รับงานใหม่: ${e.task.title} — สั่งโดย ${e.task.assigner_name}` : `New task: ${e.task.title}`);
        } else {
          setNotice(th ? `งาน ${e.task.code} อัปเดตสถานะ: ${STATUS_LABEL[e.task.status]}` : `Task ${e.task.code} updated`);
        }
        noticeTimer.current = setTimeout(() => setNotice(""), 6000);
      },
      setWsOn,
    );
    return () => {
      mounted = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  async function setStatus(t: Task, status: TaskStatus) {
    setErr("");
    try {
      await api<Task>(`/api/tasks/${t.public_id}/status`, { method: "PATCH", json: { status } });
      loadTasks();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function changeRole(publicId: string, role: string) {
    try {
      await api(`/api/users/${publicId}/role`, { method: "PATCH", json: { role } });
      loadUsers();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const t = (thTxt: string, enTxt: string) => (th ? thTxt : enTxt);

  if (!API_CONFIGURED) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <ClipboardList size={40} className="mx-auto text-gray-300" />
        <h1 className="text-lg font-semibold text-govblue-800 mt-4">
          {t("ระบบสั่งงานยังไม่เชื่อมต่อหลังบ้าน", "Task system not connected")}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {t(
            "ตั้งค่า NEXT_PUBLIC_API_URL ชี้มาที่ Go backend แล้ว deploy ใหม่ (ดูคู่มือ DEPLOY-BACKEND.md)",
            "Set NEXT_PUBLIC_API_URL to your Go backend and redeploy (see DEPLOY-BACKEND.md)",
          )}
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">
        <div className="animate-pulse">{t("กำลังตรวจสอบตัวตน...", "Checking identity...")}</div>
      </main>
    );
  }

  if (needLogin || !me) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 text-center">
        <ClipboardList size={40} className="mx-auto text-govblue-600" />
        <h1 className="text-lg font-semibold text-govblue-800 mt-4">
          {t("เข้าสู่ระบบเพื่อใช้ระบบสั่งงาน", "Sign in to use the task system")}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {t(
            "ระบบสั่งงานใช้ตัวตนจาก LINE Login เพื่อรู้ว่างานเป็นของใคร และส่งแจ้งเตือนเข้า LINE ของคุณ",
            "The task system uses LINE Login identity for assignment and LINE notifications",
          )}
        </p>
        <button
          onClick={signInWithLine}
          disabled={authing}
          className="mt-6 w-full bg-[#06C755] hover:bg-[#05b34d] text-white font-medium py-2.5 rounded-lg inline-flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-60"
        >
          {t("เข้าสู่ระบบด้วย LINE", "Sign in with LINE")}
        </button>
      </main>
    );
  }

  const isSup = me.role === "supervisor";

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* header */}
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-xl sm:text-2xl font-bold text-govblue-800">
          {t("งานสั่งงาน", "Task Orders")}
        </h1>
        {isSup && (
          <Link
            href="/tasks/new"
            className="inline-flex items-center gap-1.5 bg-govblue-700 hover:bg-govblue-600 text-white text-sm font-medium px-3.5 py-2 rounded-lg shadow-sm transition"
          >
            <Plus size={16} /> {t("สั่งงานใหม่", "New task")}
          </Link>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {me.display_name} · {isSup ? t("หัวหน้างาน", "Supervisor") : t("เจ้าหน้าที่สำรวจ", "Field Officer")} ·{" "}
        <span className={`inline-flex items-center gap-1 ${wsOn ? "text-emerald-600" : "text-gray-400"}`}>
          <Radio size={12} /> {wsOn ? t("Realtime เชื่อมต่อแล้ว", "Realtime connected") : t("Realtime หลุด กำลังเชื่อมใหม่", "Realtime reconnecting")}
        </span>
      </p>

      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-4 py-2.5 flex items-center gap-2 animate-in">
          <Bell2 /> {notice}
        </div>
      )}
      {err && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{err}</div>
      )}

      {/* task list */}
      <div className="space-y-3">
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center py-12 text-gray-400 text-sm">
            {t("ยังไม่มีงาน — งานที่หัวหน้าสั่งจะแสดงที่นี่ทันทีแบบ Realtime", "No tasks yet — assigned tasks appear here in realtime")}
          </div>
        )}
        {tasks.map((task) => {
          const next = NEXT_STATUS[task.status];
          const mine = task.assignee_public_id === me.public_id;
          return (
            <div key={task.public_id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-mono text-gray-500">{task.code}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[task.status]}`}>
                  {STATUS_LABEL[task.status]}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-govblue-50 text-govblue-700 font-medium">
                  {TYPE_LABEL[task.task_type]}
                </span>
                {isSup && (
                  <span className="text-[11px] text-gray-400">
                    {t("ผู้รับ", "Assignee")}: {task.assignee_name}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-govblue-900">{task.title}</h3>
              {task.description && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{task.description}</p>}
              <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                <div>
                  {t("สั่งโดย", "By")}: <span className="text-gray-700">{task.assigner_name}</span>
                </div>
                <div>
                  {t("กำหนดส่ง", "Due")}: <span className="text-gray-700">{fmtDateTime(task.due_at)}</span>
                </div>
                {task.place_name && (
                  <div className="flex items-center gap-1 sm:col-span-2">
                    <MapPin size={12} /> <span className="text-gray-700">{task.place_name}</span>
                  </div>
                )}
                {task.lat != null && task.lng != null && (
                  <div className="sm:col-span-2">
                    <a
                      className="text-govblue-600 hover:underline inline-flex items-center gap-1"
                      href={`https://www.google.com/maps?q=${task.lat},${task.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={12} /> {task.lat.toFixed(6)}, {task.lng.toFixed(6)} — {t("เปิดแผนที่", "Open map")}
                    </a>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {mine && next && task.status !== "cancelled" && (
                  <button
                    onClick={() => setStatus(task, next.to)}
                    className="text-xs font-medium bg-govblue-700 hover:bg-govblue-600 text-white px-3 py-1.5 rounded-lg transition"
                  >
                    {next.label}
                  </button>
                )}
                {isSup && task.status !== "done" && task.status !== "cancelled" && (
                  <button
                    onClick={() => setStatus(task, "cancelled")}
                    className="text-xs font-medium border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition"
                  >
                    {t("ยกเลิกงาน", "Cancel task")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* members (supervisor only) */}
      {isSup && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-base font-semibold text-govblue-800 mb-3">
            <Users size={18} /> {t("สมาชิกในสังกัด", "Team members")}
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.public_id} className="flex items-center gap-3 px-4 py-3">
                {u.picture_url ? (
                  <img src={u.picture_url} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-200" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-govblue-100 text-govblue-700 flex items-center justify-center text-sm font-bold">
                    {u.display_name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800 truncate">{u.display_name}</div>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u.public_id, e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-govblue-500/20"
                >
                  <option value="subordinate">{t("ลูกน้อง", "Subordinate")}</option>
                  <option value="supervisor">{t("หัวหน้างาน", "Supervisor")}</option>
                </select>
              </div>
            ))}
            {users.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">{t("ยังไม่มีสมาชิก", "No members yet")}</div>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            {t(
              "สมาชิกใหม่เกิดจากการเข้าสู่ระบบด้วย LINE ครั้งแรก (คนแรกของระบบจะเป็นหัวหน้าอัตโนมัติ)",
              "Members are created on first LINE sign-in (the first user becomes supervisor automatically)",
            )}
          </p>
        </section>
      )}
    </main>
  );
}

function Bell2() {
  return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />;
}
