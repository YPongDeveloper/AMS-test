"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Languages, ChevronRight, AlertCircle, ShieldAlert } from "lucide-react";
import { API_CONFIGURED, getAccessToken, getCurrentUser, loginWithPassword, loginDemo, type AppUser } from "@/lib/api";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [isFetchError, setIsFetchError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reasonMsg, setReasonMsg] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const t2 = (thTxt: string, enTxt: string) => (lang === "th" ? thTxt : enTxt);

  function routeByRole(u: AppUser) {
    if (u.role === "admin") router.replace("/admin");
    else if (u.role === "supervisor") router.replace("/tasks");
    else if (u.role === "accountant") router.replace("/tax");
    else router.replace("/tasks");
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const r = sp.get("reason");
      if (r === "session_expired") {
        setReasonMsg(
          lang === "th"
            ? "เซสชันการใช้งานของคุณหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่เพื่อความปลอดภัย"
            : "Your session has expired. Please sign in again for security."
        );
      } else if (r === "unauthorized") {
        setReasonMsg(
          lang === "th"
            ? "บัญชีของคุณไม่มีสิทธิ์เข้าถึงหน้านั้น"
            : "Access denied: your role does not have permission for that resource."
        );
      }
    }

    if (getAccessToken()) {
      const u = getCurrentUser();
      if (u) {
        setIsRedirecting(true);
        routeByRole(u);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(uName: string, pWord: string) {
    setErr("");
    setIsFetchError(false);
    if (!API_CONFIGURED) {
      router.push("/dashboard");
      return;
    }
    setBusy(true);
    try {
      const u = await loginWithPassword(uName.trim(), pWord);
      routeByRole(u);
    } catch (e) {
      const msg = (e as Error).message || "";
      if (msg.toLowerCase().includes("failed to fetch")) {
        setIsFetchError(true);
        setErr(
          lang === "th"
            ? "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์หลังบ้านได้ (Failed to fetch) — เซิร์ฟเวอร์ Render ฟรีอาจกำลังหลับ (Cold start 30-50 วินาที) หรือติดปัญหา CORS ของโดเมนใหม่"
            : "Cannot connect to backend (Failed to fetch) — Render free tier might be starting up (Cold start) or blocked by CORS."
        );
      } else {
        setErr(msg || "เข้าสู่ระบบไม่สำเร็จ โปรดตรวจสอบชื่อผู้ใช้และรหัสผ่าน");
      }
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

  const inputCls =
    "w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 transition";

  if (isRedirecting) {
    return null;
  }

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

          {reasonMsg && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 p-3 text-xs flex items-start gap-2 shadow-xs">
              <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <span>{reasonMsg}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                {t("loginUsername")}
              </label>
              <input
                className={inputCls}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ชื่อผู้ใช้งาน (admin / leader / normal / accountant)"
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
              <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs p-3 space-y-2">
                <div className="flex items-start gap-1.5">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
                {isFetchError && (
                  <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const targetRole =
                          username === "admin"
                            ? "admin"
                            : username === "normal"
                            ? "subordinate"
                            : username === "accountant"
                            ? "accountant"
                            : "supervisor";
                        const u = loginDemo(targetRole);
                        routeByRole(u);
                      }}
                      className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium transition text-[11px] shadow-xs"
                    >
                      เข้าสู่ระบบโหมดทดสอบ (Demo) ทันที
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLogin(username || "leader", password || "leader")}
                      className="text-rose-700 hover:underline text-[11px]"
                    >
                      ลองเชื่อมต่อใหม่
                    </button>
                  </div>
                )}
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
        </div>
      </div>
    </div>
  );
}
