"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  api,
  API_CONFIGURED,
  TYPE_LABEL,
  type AppUser,
  fetchMyTeam,
  assignRevisionRequest,
  type TeamMember,
  notifyDataUpdated,
} from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Page } from "@/components/Page";
import MapPicker from "@/components/MapPicker";
import { searchAddressCoordinates } from "@/lib/geocoding";
import { ClipboardList, Users, Layers, AlertCircle, Search, MapPin } from "lucide-react";

function NewTaskContent() {
  const { lang } = useI18n();
  const th = lang === "th";
  const t = (thTxt: string, enTxt: string) => (th ? thTxt : enTxt);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me, loading, needLogin, serverDown, retry } = useMe();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<"survey_new" | "revision" | "batch_entry">("survey_new");
  const [batchTargetType, setBatchTargetType] = useState<"land" | "building">("land");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [isTeamAssignee, setIsTeamAssignee] = useState(false);

  const handleAddressSearch = async () => {
    const q = address.trim() || placeName.trim();
    if (!q) return;
    setGeocoding(true);
    setGeocodeMsg(null);
    try {
      const res = await searchAddressCoordinates(q);
      if (res) {
        setLat(res.lat);
        setLng(res.lng);
        if (!placeName && res.displayName) {
          setPlaceName(res.displayName.split(",")[0]);
        }
        setGeocodeMsg({
          text: `ปักหมุดสำเร็จ: ${res.displayName.split(",")[0]} (${res.lat}, ${res.lng}) - หากคลาดเคลื่อน สามารถคลิก/ลากหมุดบนแผนที่เพื่อปรับตำแหน่งเองได้`,
          tone: "ok",
        });
      } else {
        setGeocodeMsg({
          text: "ไม่พบตำแหน่งจากที่อยู่นี้ กรุณาคลิกปักหมุดบนแผนที่โดยตรง หรือวางพิกัดจาก Google Maps",
          tone: "err",
        });
      }
    } catch {
      setGeocodeMsg({
        text: "ค้นหาไม่สำเร็จ กรุณาคลิกปักหมุดบนแผนที่โดยตรง",
        tone: "err",
      });
    } finally {
      setGeocoding(false);
    }
  };

  const requestId = searchParams.get("request_id");

  // Initial read from query params (e.g. from accountant request)
  useEffect(() => {
    const qType = searchParams.get("request_type");
    const qTargetType = searchParams.get("target_type") as "land" | "building" | null;
    const qTargetCode = searchParams.get("target_code");
    const qRemarks = searchParams.get("remarks");

    if (qType === "survey_new") {
      setTaskType("survey_new");
    } else if (qType === "revision" || requestId) {
      setTaskType("revision");
    }

    if (qTargetType) {
      setBatchTargetType(qTargetType);
    }

    if (qRemarks || qTargetCode) {
      const typeStr = qTargetType === "land" ? "แปลงที่ดิน" : qTargetType === "building" ? "สิ่งปลูกสร้าง" : "";
      setTitle(`ตรวจสอบ/แก้ไขข้อมูล ${typeStr} ${qTargetCode || ""}`.trim());
      setDescription(
        `[คำร้องจากฝ่ายบัญชี]: ${qRemarks || "ขอให้ตรวจสอบข้อมูล"}\nรหัสทรัพย์สิน: ${qTargetCode || "-"}`
      );
    }
  }, [searchParams, requestId]);

  useEffect(() => {
    if (me?.role === "supervisor" || me?.role === "admin") {
      const qAssignee = searchParams.get("assignee");
      Promise.all([
        fetchMyTeam().catch(() => [] as TeamMember[]),
        api<AppUser[]>("/api/users?role=subordinate").catch(() => [] as AppUser[]),
      ]).then(([myTeam, allSubordinates]) => {
        const safeTeam = Array.isArray(myTeam) ? myTeam : [];
        const acceptedMembers = safeTeam.filter((m) => m && m.status === "accepted");
        const pendingMember = safeTeam.find(
          (m) => m && m.status === "pending" && m.subordinate_public_id === qAssignee
        );
        if (pendingMember) {
          setErr(
            th
              ? `ไม่สามารถมอบหมายงานให้ ${pendingMember.subordinate_name || pendingMember.subordinate_username} ได้ เนื่องจากยังอยู่ระหว่างรอการตอบรับคำเชิญเข้าร่วมทีม`
              : `Cannot assign task to ${pendingMember.subordinate_name || pendingMember.subordinate_username}: invitation is still pending acceptance.`
          );
        }

        // 1. เพิ่มตัวเลือกให้หัวหน้าสั่งงานตัวเองเพื่อลงสำรวจเองได้
        const selfOption: AppUser = {
          public_id: me.public_id,
          username: me.username || "me",
          display_name: `${me.display_name} (ฉันเอง - ลงพื้นที่สำรวจเอง)`,
          role: me.role,
          status: "active",
          picture_url: me.picture_url || null,
          created_at: "",
        };

        setIsTeamAssignee(true);
        const teamUsers: AppUser[] = acceptedMembers.map((m) => ({
          public_id: m.subordinate_public_id,
          username: m.subordinate_username || "",
          display_name: m.subordinate_name || m.subordinate_username || "สมาชิกทีม",
          role: "subordinate",
          status: "active",
          picture_url: null,
          created_at: "",
        }));
        const combined = [selfOption, ...teamUsers];
        setUsers(combined);
        if (qAssignee && combined.some((u) => u.public_id === qAssignee)) {
          setSelectedAssignees([qAssignee]);
        } else if (teamUsers[0]?.public_id) {
          setSelectedAssignees([teamUsers[0].public_id]);
        } else if (selfOption.public_id) {
          setSelectedAssignees([selfOption.public_id]);
        }
      });
    }
  }, [me, searchParams]);

  const inputCls =
    "w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 transition";
  const labelCls = "text-xs font-medium text-gray-700 mb-1.5 block";

  if (!loading && needLogin && !me) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <ClipboardList size={40} className="mx-auto text-govblue-600" />
        <p className="text-sm text-gray-600 mt-4">
          {t("กรุณาเข้าสู่ระบบเพื่อสั่งงาน", "Sign in to assign tasks")}
        </p>
        <Link
          href="/"
          className="mt-4 inline-block w-full bg-govblue-700 hover:bg-govblue-600 text-white font-medium py-2.5 rounded-lg transition text-center"
        >
          {t("ไปหน้าเข้าสู่ระบบ", "Go to Sign in")}
        </Link>
      </div>
    );
  }

  if (!loading && serverDown && !me) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <p className="text-sm text-gray-600">
          {t("เซิร์ฟเวอร์กำลังเริ่มทำงาน ลองใหม่อีกครั้ง", "Server is waking up — retry")}
        </p>
        <button
          onClick={retry}
          className="mt-4 w-full bg-govblue-700 hover:bg-govblue-600 text-white font-medium py-2.5 rounded-lg transition"
        >
          {t("ลองเชื่อมต่อใหม่", "Retry connection")}
        </button>
      </div>
    );
  }

  if (loading || !me) {
    return <div className="py-16 text-center text-gray-400 animate-pulse">กำลังโหลด...</div>;
  }

  if (me.role !== "supervisor" && me.role !== "admin") {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-gray-600">
          {t("เฉพาะผู้ดูแลระบบและหัวหน้างานเท่านั้นที่สั่งงานได้", "Only admins and supervisors can assign tasks")}
        </p>
      </div>
    );
  }

  async function submit() {
    setErr("");
    if (!title.trim()) {
      setErr(t("กรุณากรอกชื่องาน", "Task title is required"));
      return;
    }
    if (selectedAssignees.length === 0) {
      setErr(t("กรุณาเลือกผู้รับงานอย่างน้อย 1 คน", "Select at least one assignee"));
      return;
    }

    const selectedUsers = users.filter((u) => selectedAssignees.includes(u.public_id));
    const assigneeNames = selectedUsers.map((u) => u.display_name.replace(" (ฉันเอง - ลงพื้นที่สำรวจเอง)", ""));
    const combinedAssigneeName = assigneeNames.join(", ");
    const primaryAssigneeId = selectedAssignees[0] || "";

    setSaving(true);
    try {
      const res = await api<{ public_id?: string; id?: string }>("/api/tasks", {
        method: "POST",
        json: {
          title: title.trim(),
          task_type: taskType,
          target_type: taskType === "batch_entry" ? batchTargetType : null,
          description: description.trim(),
          assignee_public_id: primaryAssigneeId,
          assignee_public_ids: selectedAssignees,
          assignee_name: combinedAssigneeName,
          assignee_names: assigneeNames,
          due_at: dueLocal ? new Date(dueLocal).toISOString() : null,
          lat: taskType === "batch_entry" ? null : lat,
          lng: taskType === "batch_entry" ? null : lng,
          place_name: taskType === "batch_entry" ? null : (placeName.trim() || null),
          address: taskType === "batch_entry" ? null : (address.trim() || null),
        },
      });

      if (requestId && res?.public_id) {
        await assignRevisionRequest(requestId, res.public_id).catch(() => {});
      }

      notifyDataUpdated();
      router.push("/tasks");
    } catch (e) {
      if (!API_CONFIGURED) {
        const newTask = {
          public_id: "mock-" + Date.now(),
          code: "TSK-" + String(Math.floor(100000 + Math.random() * 900000)),
          title: title.trim(),
          task_type: taskType,
          description: description.trim(),
          status: "pending",
          assignee_public_id: primaryAssigneeId,
          assignee_public_ids: selectedAssignees,
          assignee_name:
            combinedAssigneeName ||
            (primaryAssigneeId === me?.public_id ? me?.display_name || "หัวหน้างานสำรวจ" : "เจ้าหน้าที่สำรวจ"),
          assignee_names: assigneeNames,
          assigner_public_id: me?.public_id || "mock-leader",
          assigner_name: me?.display_name || "หัวหน้างานสำรวจ",
          due_at: dueLocal ? new Date(dueLocal).toISOString() : null,
          lat: taskType === "batch_entry" ? null : lat,
          lng: taskType === "batch_entry" ? null : lng,
          place_name: taskType === "batch_entry" ? null : (placeName.trim() || null),
          address: taskType === "batch_entry" ? null : (address.trim() || null),
          target_type: taskType === "batch_entry" ? batchTargetType : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        try {
          const raw = window.localStorage.getItem("ams_saved_tasks_v6") || window.localStorage.getItem("ams_saved_tasks_v5");
          const existing = raw ? JSON.parse(raw) : [];
          window.localStorage.setItem(
            "ams_saved_tasks_v6",
            JSON.stringify([newTask, ...(Array.isArray(existing) ? existing : [])])
          );
        } catch {}
        notifyDataUpdated();
        router.push("/tasks");
        return;
      }
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-5 sm:p-6 space-y-4">
      {requestId && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span>กำลังสั่งงานเพื่อแก้ไขตามคำร้องของฝ่ายบัญชี (เมื่อส่งงาน คำร้องจะถูกผูกกับงานนี้)</span>
        </div>
      )}

      <div>
        <label className={labelCls}>{t("ชื่องาน *", "Title *")}</label>
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("ตย. ลงสำรวจแปลงที่ดิน รหัส LP-2569-0042 หรือ ลงข้อมูลอาคารใหม่", "e.g. Survey parcel LP-2569-0042")}
        />
      </div>

      {/* 3 รูปแบบการสั่งงาน */}
      <div>
        <label className={labelCls}>{t("รูปแบบการสั่งงาน (Task Type) *", "Work Order Type *")}</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setTaskType("survey_new")}
            className={`p-3 rounded-xl border text-left transition ${
              taskType === "survey_new"
                ? "border-govblue-600 bg-blue-50/60 text-govblue-900 ring-2 ring-govblue-500/20"
                : "border-gray-200 hover:bg-gray-50 text-gray-700"
            }`}
          >
            <div className="font-semibold text-xs text-govblue-800">1. สำรวจใหม่</div>
            <div className="text-[10px] text-gray-500 mt-1">ชี้เป้าสถานที่บนแผนที่ เพื่อให้ลูกน้องลงพื้นที่สำรวจ</div>
          </button>

          <button
            type="button"
            onClick={() => setTaskType("revision")}
            className={`p-3 rounded-xl border text-left transition ${
              taskType === "revision"
                ? "border-govblue-600 bg-blue-50/60 text-govblue-900 ring-2 ring-govblue-500/20"
                : "border-gray-200 hover:bg-gray-50 text-gray-700"
            }`}
          >
            <div className="font-semibold text-xs text-govblue-800">2. แก้ไขงาน</div>
            <div className="text-[10px] text-gray-500 mt-1">สั่งแก้ไขข้อมูลทรัพย์สินตามคำร้องหรือข้อผิดพลาด</div>
          </button>

          <button
            type="button"
            onClick={() => setTaskType("batch_entry")}
            className={`p-3 rounded-xl border text-left transition ${
              taskType === "batch_entry"
                ? "border-govblue-600 bg-blue-50/60 text-govblue-900 ring-2 ring-govblue-500/20"
                : "border-gray-200 hover:bg-gray-50 text-gray-700"
            }`}
          >
            <div className="font-semibold text-xs text-govblue-800">3. ลงข้อมูลใหม่</div>
            <div className="text-[10px] text-gray-500 mt-1">ไม่มีแผนที่ สั่งให้ลูกน้องลงข้อมูลพร้อมกันหลายรายการ</div>
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelCls}>
              {t("ผู้รับงาน (เลือกได้มากกว่า 1 คน) *", "Assignees (Select 1 or more) *")}
              {isTeamAssignee && (
                <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                  ทีมของคุณ
                </span>
              )}
            </label>
            <span className="text-[11px] text-govblue-700 font-semibold">
              {selectedAssignees.length > 0
                ? t(`เลือกแล้ว ${selectedAssignees.length} คน`, `Selected ${selectedAssignees.length}`)
                : t("ยังไม่ได้เลือก", "None selected")}
            </span>
          </div>

          <div className="border border-gray-300 rounded-xl p-2 max-h-48 overflow-y-auto space-y-1.5 bg-gray-50/50">
            {users.length === 0 ? (
              <div className="text-xs text-gray-400 py-3 text-center">
                {t("— ยังไม่มีลูกน้องในระบบหรือในทีม —", "— no subordinates yet —")}
              </div>
            ) : (
              users.map((u) => {
                const isSelected = selectedAssignees.includes(u.public_id);
                return (
                  <label
                    key={u.public_id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-xs transition border ${
                      isSelected
                        ? "bg-govblue-50 border-govblue-300 text-govblue-900 font-semibold shadow-2xs"
                        : "bg-white border-gray-200 hover:bg-gray-100 text-gray-700 font-normal"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAssignees((prev) => [...prev, u.public_id]);
                        } else {
                          setSelectedAssignees((prev) => prev.filter((id) => id !== u.public_id));
                        }
                      }}
                      className="w-4 h-4 text-govblue-600 rounded border-gray-300 focus:ring-govblue-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <span className="truncate">{u.display_name}</span>
                      <span className="text-[10px] text-gray-400 font-normal shrink-0">@{u.username}</span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          {users.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1">
              ยังไม่มีลูกน้องในทีม กรุณาไปที่หน้ารายการงาน แล้วกดปุ่ม "จัดการทีม" เพื่อเชิญลูกน้องเข้าทีม
            </p>
          )}
          <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
            💡 {t(
              "เลือกผู้รับงานได้มากกว่า 1 คน — ทุกคนจะเห็นงานใน 'งานของฉัน' และคนใดคนหนึ่งกดยอมรับงาน ระบบจะถือว่ารับงานแล้วทั้งทีม",
              "Select 1 or more assignees. Any assigned member can accept the task, marking it accepted for all."
            )}
          </p>
        </div>

        <div>
          <label className={labelCls}>{t("กำหนดเสร็จ (วัน-เวลา)", "Due date & time")}</label>
          <input type="datetime-local" className={inputCls} value={dueLocal} onChange={(e) => setDueLocal(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelCls}>{t("รายละเอียดงาน / คำสั่ง", "Description")}</label>
        <textarea
          className={inputCls + " min-h-24"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("รายละเอียดงานที่สั่ง เช่น ขอบเขต ข้อมูลที่ต้องการให้ลง หรือจุดที่ต้องตรวจสอบ", "Scope, instructions...")}
        />
      </div>

      {/* ถ้าเป็น batch_entry ซ่อนแผนที่ และแสดงตัวเลือกประเภททรัพย์สิน */}
      {taskType === "batch_entry" ? (
        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <Layers size={16} className="text-amber-600" />
            <span>โหมดลงข้อมูลใหม่ (Batch Data Entry) — ไม่มีการระบุพิกัดแผนที่</span>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed">
            ผู้รับงานจะสามารถกรอกบันทึกข้อมูลทรัพย์สินได้หลายรายการพร้อมกันในคราวเดียว แล้วส่งให้ท่านตรวจสอบอนุมัติก่อนบันทึกลงระบบจริง
          </p>
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">
              ประเภททรัพย์สินที่จะให้ลูกน้องลงข้อมูล:
            </label>
            <div className="flex gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                <input
                  type="radio"
                  name="batchTarget"
                  value="land"
                  checked={batchTargetType === "land"}
                  onChange={() => setBatchTargetType("land")}
                  className="text-govblue-600 focus:ring-govblue-500"
                />
                <span>แปลงที่ดิน (Land Parcels)</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                <input
                  type="radio"
                  name="batchTarget"
                  value="building"
                  checked={batchTargetType === "building"}
                  onChange={() => setBatchTargetType("building")}
                  className="text-govblue-600 focus:ring-govblue-500"
                />
                <span>สิ่งปลูกสร้าง (Buildings)</span>
              </label>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
              <MapPin size={15} className="text-rose-500" />
              <span>{t("ที่อยู่และพิกัดสถานที่สำรวจ (Location & Address)", "Location Coordinates & Address")}</span>
            </label>
            <span className="text-[11px] text-gray-500">
              {t("หัวหน้าใส่ที่อยู่ไว้ก่อนได้ พนักงานจะเห็นข้อมูลนี้ทันที", "Supervisor can pre-fill address for surveyor")}
            </span>
          </div>

          <div className="space-y-2 mb-3">
            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">
                {t("ที่อยู่ / ตำแหน่งที่ตั้ง (Address)", "Address / Location")}
              </label>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddressSearch();
                    }
                  }}
                  placeholder={t(
                    "เช่น 123/4 ถ.พหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ หรือ สถานีรถไฟอยุธยา",
                    "e.g. 123/4 Phahonyothin Rd, Chatuchak, Bangkok or Ayutthaya Railway Station"
                  )}
                />
                <button
                  type="button"
                  onClick={handleAddressSearch}
                  disabled={geocoding || (!address.trim() && !placeName.trim())}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-govblue-800 hover:bg-govblue-700 disabled:opacity-50 rounded-lg shrink-0 flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Search size={14} />
                  <span>{geocoding ? t("กำลังค้นหา...", "Searching...") : t("ค้นหาพิกัด", "Find Pin")}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 block mb-1">
                {t("ชื่อสถานที่ / หมายเลขแปลง / จุดสังเกต (Place Name)", "Place Name / Parcel Code / Landmark")}
              </label>
              <input
                className={inputCls}
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder={t("ตย. สถานีรถไฟกรุงเทพ (หัวลำโพง) หรือ แปลงย่านอยุธยา A-1", "e.g. Ayutthaya Railway Station")}
              />
            </div>

            {geocodeMsg && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  geocodeMsg.tone === "ok"
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                    : "bg-amber-50 text-amber-900 border border-amber-200"
                }`}
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{geocodeMsg.text}</span>
              </div>
            )}

            <p className="text-[11px] text-gray-500">
              💡 เมื่อใส่ที่อยู่แล้วกด "ค้นหาพิกัด" หมุดจะเลื่อนไปยังตำแหน่งนั้นโดยอัตโนมัติ <strong>หากคลาดเคลื่อน สามารถคลิกหรือลากหมุดบนแผนที่เพื่อปรับตำแหน่งเองได้</strong>
            </p>
          </div>

          <MapPicker lat={lat} lng={lng} onChange={(a, b) => { setLat(a); setLng(b); }} />
        </div>
      )}

      {err && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{err}</div>}

      <div className="flex gap-2 pt-2">
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 bg-gradient-to-r from-govblue-700 to-govblue-600 hover:from-govblue-800 hover:to-govblue-700 text-white font-medium py-2.5 rounded-lg shadow-sm transition disabled:opacity-60"
        >
          {saving ? t("กำลังบันทึกและส่งงาน...", "Assigning...") : t("ส่งมอบหมายงานให้ลูกน้อง", "Assign Task")}
        </button>
        <button
          onClick={() => router.push("/tasks")}
          className="px-4 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          {t("ยกเลิก", "Cancel")}
        </button>
      </div>
    </div>
  );
}

export default function NewTaskPage() {
  const { lang } = useI18n();
  const th = lang === "th";
  const t = (thTxt: string, enTxt: string) => (th ? thTxt : enTxt);

  return (
    <Page allowedRoles={["admin", "supervisor"]}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-govblue-800 mb-1">{t("สั่งงานใหม่", "New task")}</h1>
        <p className="text-xs text-gray-500 mb-5">
          {t(
            "สั่งมอบหมายงานสำรวจ แก้ไขงาน หรือลงข้อมูลใหม่ให้พนักงานสำรวจในทีม",
            "Assign survey, revision, or batch data entry task to field officers in your team",
          )}
        </p>
        <Suspense fallback={<div className="text-center py-10 text-gray-400">กำลังโหลด...</div>}>
          <NewTaskContent />
        </Suspense>
      </div>
    </Page>
  );
}
