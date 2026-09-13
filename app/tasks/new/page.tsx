"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { api, TYPE_LABEL, type AppUser } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import MapPicker from "@/components/MapPicker";
import { ClipboardList } from "lucide-react";

export default function NewTaskPage() {
  const { lang } = useI18n();
  const th = lang === "th";
  const t = (thTxt: string, enTxt: string) => (th ? thTxt : enTxt);
  const router = useRouter();
  const { me, loading, needLogin, authing, signInWithLine } = useMe();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("survey");
  const [assignee, setAssignee] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (me?.role === "supervisor") {
      api<AppUser[]>("/api/users?role=subordinate")
        .then((us) => {
          setUsers(us);
          if (us.length > 0) setAssignee(us[0].id);
        })
        .catch(() => {});
    }
  }, [me]);

  if (!loading && needLogin) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 text-center">
        <ClipboardList size={40} className="mx-auto text-govblue-600" />
        <p className="text-sm text-gray-600 mt-4">{t("เข้าสู่ระบบด้วย LINE เพื่อสั่งงาน", "Sign in with LINE to assign tasks")}</p>
        <button
          onClick={signInWithLine}
          disabled={authing}
          className="mt-4 w-full bg-[#06C755] hover:bg-[#05b34d] text-white font-medium py-2.5 rounded-lg transition disabled:opacity-60"
        >
          {t("เข้าสู่ระบบด้วย LINE", "Sign in with LINE")}
        </button>
      </main>
    );
  }

  if (loading || !me) {
    return <main className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400 animate-pulse">...</main>;
  }

  if (me.role !== "supervisor") {
    return (
      <main className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-sm text-gray-600">
          {t("เฉพาะหัวหน้างานเท่านั้นที่สั่งงานได้", "Only supervisors can assign tasks")}
        </p>
      </main>
    );
  }

  async function submit() {
    setErr("");
    if (!title.trim()) {
      setErr(t("กรุณากรอกชื่องาน", "Task title is required"));
      return;
    }
    if (!assignee) {
      setErr(t("กรุณาเลือกผู้รับงาน", "Select an assignee"));
      return;
    }
    setSaving(true);
    try {
      await api("/api/tasks", {
        method: "POST",
        json: {
          title: title.trim(),
          task_type: taskType,
          description: description.trim(),
          assigned_to: assignee,
          due_at: dueLocal ? new Date(dueLocal).toISOString() : null,
          lat,
          lng,
          place_name: placeName.trim() || null,
        },
      });
      router.push("/tasks");
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 transition";
  const labelCls = "text-xs font-medium text-gray-700 mb-1.5 block";

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-xl sm:text-2xl font-bold text-govblue-800 mb-1">{t("สั่งงานใหม่", "New task")}</h1>
      <p className="text-xs text-gray-500 mb-5">
        {t(
          "เมื่อกดสั่งงาน ระบบจะแจ้งเตือนลูกน้องทันทีทั้ง Realtime บนหน้าเว็บและข้อความ LINE",
          "On submit, the assignee gets an instant realtime alert on the web plus a LINE message",
        )}
      </p>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 sm:p-6 space-y-4">
        <div>
          <label className={labelCls}>{t("ชื่องาน *", "Title *")}</label>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("ตย. เก็บข้อมูลแปลงที่ดิน รหัส LP-2569-0042", "e.g. Survey parcel LP-2569-0042")}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t("ประเภทงาน", "Task type")}</label>
            <select className={inputCls} value={taskType} onChange={(e) => setTaskType(e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("ผู้รับงาน (ลูกน้องในสังกัด) *", "Assignee *")}</label>
            <select className={inputCls} value={assignee ?? ""} onChange={(e) => setAssignee(Number(e.target.value))}>
              {users.length === 0 && <option value="">{t("— ยังไม่มีลูกน้องในระบบ —", "— no subordinates yet —")}</option>}
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>{t("กำหนดเสร็จ (วัน-เวลา)", "Due date & time")}</label>
          <input type="datetime-local" className={inputCls} value={dueLocal} onChange={(e) => setDueLocal(e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>{t("รายละเอียดงาน", "Description")}</label>
          <textarea
            className={inputCls + " min-h-24"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("รายละเอียดงานที่สั่ง เช่น ขอบเขต จุดสำคัญ อุปกรณ์ที่ต้องใช้", "Scope, key points, required equipment...")}
          />
        </div>

        <div>
          <label className={labelCls}>{t("พิกัดสถานที่", "Location")}</label>
          <input
            className={inputCls + " mb-2"}
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            placeholder={t("ชื่อสถานที่ / หมายเลขแปลง / จุดสังเกต (ถ้ามี)", "Place name / parcel code / landmark (optional)")}
          />
          <MapPicker lat={lat} lng={lng} onChange={(a, b) => { setLat(a); setLng(b); }} />
        </div>

        {err && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{err}</div>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-govblue-700 to-govblue-600 hover:from-govblue-800 hover:to-govblue-700 text-white font-medium py-2.5 rounded-lg shadow-sm transition disabled:opacity-60"
          >
            {saving ? t("กำลังส่ง...", "Sending...") : t("ส่งงาน + แจ้งเตือน LINE", "Assign & notify via LINE")}
          </button>
          <button
            onClick={() => router.push("/tasks")}
            className="px-4 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            {t("ยกเลิก", "Cancel")}
          </button>
        </div>
      </div>
    </main>
  );
}
