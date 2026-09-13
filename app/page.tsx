"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Languages, ChevronRight, AlertCircle } from "lucide-react";
import { API_CONFIGURED, getAccessToken, getCurrentUser, loginWithPassword, type AppUser } from "@/lib/api";
import { liffConfigured } from "@/lib/liff";
import { authenticateWithLine } from "@/lib/useMe";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lineChecking, setLineChecking] = useState(API_CONFIGURED && liffConfigured());

  const t2 = (thTxt: string, enTxt: string) => (lang === "th" ? thTxt : enTxt);

  // หลังรู้ role → พาไปหน้าตามสิทธิ์ (หัวหน้า = หน้าสั่งงาน, admin = จัดการผู้ใช้)
  function routeByRole(u: AppUser) {
    if (u.role === "supervisor") router.replace("/tasks");
    else if (u.role === "admin") router.replace("/admin");
    else router.replace("/dashboard");
  }

  useEffect(() => {
    // 1) เข้าอยู่แล้ว (เว็บ) — เด้งตาม role ทันที
    if (getAccessToken()) {
      const u = getCurrentUser();
      if (u) {
        routeByRole(u);
        return;
      }
    }
    // 2) เปิดผ่าน LINE (LIFF) — session มีอยู่แล้ว ไม่ต้อง login ซ้ำ
    if (API_CONFIGURED && liffConfigured()) {
      let cancelled = false;
      authenticateWithLine()
        .then((u) => {
          if (!cancelled) routeByRole(u);
        })
        .catch(() => {
          if (!cancelled) setLineChecking(false);
        });
      return () => {
        cancelled = true;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    // โหมดสาธิต (ยังไม่เชื่อมหลังบ้าน) — กดแล้วเข้าได้เลยตามเดิม
    if (!API_CONFIGURED) {
      router.push("/dashboard");
      return;
    }
    setBusy(true);
    try {
      const u = await loginWithPassword(username.trim(), password);
      routeByRole(u);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

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
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
          <h1 className="text-lg font-semibold text-govblue-800 mb-5">{t("loginTitle")}</h1>

          {lineChecking && (
            <div className="text-center text-sm text-gray-400 animate-pulse py-2">
              {t2("กำลังตรวจสอบตัวตน LINE...", "Checking LINE identity...")}
            </div>
          )}

          <form
            onSubmit={submit}
            className="space-y-4"
          >
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">{t("loginUsername")}</label>
              <input
                className={inputCls}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={API_CONFIGURED ? "admin / leader / normal" : "srt.field.001"}
                autoComplete="username"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-700">{t("loginPassword")}</label>
                <a href="#" className="text-[11px] text-govblue-600 hover:underline">
                  {lang === "th" ? "ลืมรหัสผ่าน?" : "Forgot?"}
                </a>
              </div>
              <input
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
              {busy ? t2("กำลังเข้าสู่ระบบ...", "Signing in...") : t("loginSignIn")} <ChevronRight size={16} />
            </button>
          </form>

          {API_CONFIGURED ? (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-gray-200 flex-1" />
                <span className="text-[11px] text-gray-400">{t2("หรือ", "or")}</span>
                <div className="h-px bg-gray-200 flex-1" />
              </div>
              <button
                type="button"
                onClick={async () => {
                  setLineChecking(true);
                  try {
                    const u = await authenticateWithLine();
                    if (u.role === "supervisor") router.replace("/tasks");
                    else if (u.role === "admin") router.replace("/admin");
                    else router.replace("/dashboard");
                  } catch {
                    setLineChecking(false);
                    setErr(t2("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองอีกครั้ง", "LINE sign-in failed, try again"));
                  }
                }}
                className="w-full bg-[#06C755] hover:bg-[#05b34d] text-white font-medium py-2.5 rounded-lg inline-flex items-center justify-center gap-2 shadow-sm hover:shadow transition disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.2 2 1.5 5.9 1.5 10.7c0 4.3 3.9 7.9 9.2 8.6.4.1.9.2 1 .5.1.3.1.7 0 1l-.1.9c-.1.3-.2 1.1.9.6 1.2-.5 6.3-3.7 8.6-6.4 1.6-1.7 2.4-3.5 2.4-5.3C23.5 5.9 17.8 2 12 2z" />
                </svg>
                {t2("เข้าสู่ระบบด้วย LINE", "Sign in with LINE")}
              </button>
              <p className="text-center text-[11px] text-gray-400 mt-3">
                {t2("บัญชีทดลอง: admin/admin · leader/leader · normal/normal", "Demo accounts: admin/admin · leader/leader · normal/normal")}
              </p>
            </>
          ) : (
            <p className="text-center text-[11px] text-gray-400 mt-4">
              {t2(
                "โหมดสาธิต — ตั้งค่า NEXT_PUBLIC_API_URL เพื่อเปิดใช้ระบบบัญชีและ LINE Login (ดู DEPLOY-BACKEND.md)",
                "Demo mode — set NEXT_PUBLIC_API_URL to enable accounts & LINE Login (see DEPLOY-BACKEND.md)",
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
