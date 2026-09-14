"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { api, TYPE_LABEL, type AppUser, type Role } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Page } from "@/components/Page";
import { ClipboardList, ShieldCheck, X } from "lucide-react";

const ROLE_LABEL: Record<string, { th: string; en: string; tone: string }> = {
  admin: { th: "ผู้ดูแลระบบ", en: "Administrator", tone: "bg-purple-100 text-purple-700" },
  supervisor: { th: "หัวหน้างาน", en: "Supervisor", tone: "bg-govblue-50 text-govblue-700" },
  subordinate: { th: "เจ้าหน้าที่สำรวจ", en: "Field Officer", tone: "bg-gray-100 text-gray-600" },
};

export default function AdminPage() {
  const { lang } = useI18n();
  const th = lang === "th";
  const t = (thTxt: string, enTxt: string) => (th ? thTxt : enTxt);
  const { me, loading, needLogin, serverDown, retry } = useMe();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await api<AppUser[]>("/api/users"));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (me && (me.role === "admin" || me.role === "supervisor")) loadUsers();
  }, [me, loadUsers]);

  async function saveRole(role: Role) {
    if (!editing) return;
    setSaving(true);
    setErr("");
    try {
      await api(`/api/users/${editing.public_id}/role`, { method: "PATCH", json: { role } });
      setEditing(null);
      loadUsers();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const guard = () => {
    if (!loading && needLogin && !me) {
      return (
        <div className="py-16 text-center max-w-md mx-auto">
          <ClipboardList size={40} className="mx-auto text-govblue-600" />
          <p className="text-sm text-gray-600 mt-4">
            {t("กรุณาเข้าสู่ระบบเพื่อจัดการผู้ใช้", "Sign in to manage users")}
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
          <p className="text-sm text-gray-600">{t("เซิร์ฟเวอร์กำลังเริ่มทำงาน ลองใหม่อีกครั้ง", "Server is waking up — retry")}</p>
          <button onClick={retry} className="mt-4 w-full bg-govblue-700 hover:bg-govblue-600 text-white font-medium py-2.5 rounded-lg transition">
            {t("ลองเชื่อมต่อใหม่", "Retry connection")}
          </button>
        </div>
      );
    }
    if (loading || !me) {
      return <div className="py-16 text-center text-gray-400 animate-pulse">...</div>;
    }
    if (me.role !== "admin" && me.role !== "supervisor") {
      return (
        <div className="py-16 text-center">
          <p className="text-sm text-gray-600">{t("เฉพาะผู้ดูแลระบบและหัวหน้างานเท่านั้น", "Admins and supervisors only")}</p>
        </div>
      );
    }
    return null;
  };

  const guardResult = guard();

  return (
    <Page>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-govblue-800 mb-1">{t("จัดการผู้ใช้", "User Management")}</h1>
        <p className="text-xs text-gray-500 mb-5">
          {t(
            "รายชื่อผู้ใช้ทั้งหมดในระบบ — กด “ตั้งค่าบทบาท” เพื่อเปลี่ยนสิทธิ์ของแต่ละคน",
            "All users in the system — use “Set role” to change permissions",
          )}
        </p>

        {guardResult}

        {!guardResult && (
          <>
            {err && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{err}</div>}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {users.map((u) => {
                const rl = ROLE_LABEL[u.role] || ROLE_LABEL.subordinate;
                return (
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
                      <div className="text-[11px] text-gray-400">
                        {u.username ? `@${u.username}` : t("สมาชิก LINE", "LINE member")}
                      </div>
                    </div>
                    <span className={`hidden sm:inline text-[11px] px-2 py-0.5 rounded-full font-medium ${rl.tone}`}>
                      {th ? rl.th : rl.en}
                    </span>
                    <button
                      onClick={() => setEditing(u)}
                      className="text-xs font-medium border border-gray-300 text-govblue-700 hover:bg-govblue-50 px-3 py-1.5 rounded-lg transition"
                    >
                      {t("ตั้งค่าบทบาท", "Set role")}
                    </button>
                  </div>
                );
              })}
              {users.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-gray-400">{t("ยังไม่มีสมาชิก", "No members yet")}</div>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-govblue-100 bg-govblue-50/60 text-[11px] text-govblue-700 px-4 py-3 flex items-start gap-2">
              <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                {t(
                  "บัญชีมาตรฐานของระบบ: admin/admin (ผู้ดูแลระบบ) · leader/leader (หัวหน้างาน) · normal/normal (เจ้าหน้าที่)",
                  "Standard accounts: admin/admin · leader/leader · normal/normal",
                )}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Role popup */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold text-govblue-800">{t("ตั้งค่าบทบาท", "Set role")}</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4 truncate">
              {editing.display_name}
              {editing.username ? ` (@${editing.username})` : ""}
            </p>
            <div className="space-y-2">
              {(["admin", "supervisor", "subordinate"] as Role[]).map((r) => {
                const rl = ROLE_LABEL[r];
                return (
                  <button
                    key={r}
                    disabled={saving}
                    onClick={() => saveRole(r)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition disabled:opacity-50 ${
                      editing.role === r
                        ? "border-govblue-500 bg-govblue-50 text-govblue-800 font-medium"
                        : "border-gray-200 hover:border-govblue-300 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <span>{th ? rl.th : rl.en}</span>
                    <span className="text-[11px] text-gray-400">{r}</span>
                  </button>
                );
              })}
            </div>
            {err && <div className="mt-3 text-xs text-rose-600">{err}</div>}
          </div>
        </div>
      )}
    </Page>
  );
}
