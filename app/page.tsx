"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Languages, ChevronRight, AlertCircle, ShieldCheck, UserCheck, Users } from "lucide-react";
import { API_CONFIGURED, getAccessToken, getCurrentUser, loginWithPassword, type AppUser } from "@/lib/api";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const t2 = (thTxt: string, enTxt: string) => (lang === "th" ? thTxt : enTxt);

  function routeByRole(u: AppUser) {
    if (u.role === "supervisor") router.replace("/tasks");
    else if (u.role === "admin") router.replace("/admin");
    else router.replace("/dashboard");
  }

  useEffect(() => {
    if (getAccessToken()) {
      const u = getCurrentUser();
      if (u) {
        routeByRole(u);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(uName: string, pWord: string) {
    setErr("");
    if (!API_CONFIGURED) {
      router.push("/dashboard");
      return;
    }
    setBusy(true);
    try {
      const u = await loginWithPassword(uName.trim(), pWord);
      routeByRole(u);
    } catch (e) {
      setErr((e as Error).message || "เข้าสู่ระบบไม่สำเร็จ โปรดตรวจสอบชื่อผู้ใช้และรหัสผ่าน");
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErr("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    await handleLogin(username, password);
  }

  const quickLogin = async (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    await handleLogin(u, p);
  };

  const inputCls =
    "w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 transition";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-govblue-50 via-white to-govgold-50 p-4">
      {/* Lang switch */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setLang(lang === "th" ? "en" : "th")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm hover:bg-gray-50 text-xs font-medium text-gray-700"
        >
          <Languages size={14} /> {lang === "th" ? "English" : "ภาษาไทย"}
        </button>
      </div>

      <div className="w-full max-w-md">
        {/* Logo header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-govblue-700 to-govblue-600 flex items-center justify-center shadow-lg ring-4 ring-white">
            <Logo className="w-10 h-10 text-white" />
          </div>
          <div className="text-xl font-bold text-govblue-800 mt-4">{t("orgName")}</div>
          <div className="text-xs text-gray-500 mt-1">
            ระบบบริหารจัดการทรัพย์สินที่ดินและสิ่งปลูกสร้าง
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
          <h1 className="text-lg font-semibold text-govblue-800 mb-5">{t("loginTitle")}</h1>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                {t("loginUsername")}
              </label>
              <input
                className={inputCls}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ชื่อผู้ใช้งาน (admin / leader / normal)"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-700">{t("loginPassword")}</label>
              </div>
              <input
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                autoComplete="current-password"
                required
              />
            </div>

            {err && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs px-3 py-2 flex items-center gap-1.5">
                <AlertCircle size={13} /> {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-to-r from-govblue-700 to-govblue-600 hover:from-govblue-800 hover:to-govblue-700 text-white font-medium py-2.5 rounded-lg inline-flex items-center justify-center gap-2 shadow-sm hover:shadow transition disabled:opacity-60"
            >
              {busy ? t2("กำลังเข้าสู่ระบบ...", "Signing in...") : t("loginSignIn")}{" "}
              <ChevronRight size={16} />
            </button>
          </form>

          {/* Quick Login Options */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="text-[11px] font-medium text-gray-500 mb-2.5 text-center">
              เข้าสู่ระบบด่วนสำหรับการทดสอบ (Quick Sign-in)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => quickLogin("admin", "admin")}
                disabled={busy}
                className="flex flex-col items-center p-2 rounded-lg border border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 text-purple-800 transition text-center"
              >
                <ShieldCheck size={16} className="text-purple-600 mb-1" />
                <span className="text-[11px] font-semibold">แอดมิน</span>
                <span className="text-[9px] text-purple-600/80">Admin</span>
              </button>

              <button
                type="button"
                onClick={() => quickLogin("leader", "leader")}
                disabled={busy}
                className="flex flex-col items-center p-2 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 text-govblue-800 transition text-center"
              >
                <UserCheck size={16} className="text-govblue-600 mb-1" />
                <span className="text-[11px] font-semibold">หัวหน้างาน</span>
                <span className="text-[9px] text-govblue-600/80">Supervisor</span>
              </button>

              <button
                type="button"
                onClick={() => quickLogin("normal", "normal")}
                disabled={busy}
                className="flex flex-col items-center p-2 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-800 transition text-center"
              >
                <Users size={16} className="text-emerald-600 mb-1" />
                <span className="text-[11px] font-semibold">เจ้าหน้าที่</span>
                <span className="text-[9px] text-emerald-600/80">Field Officer</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
