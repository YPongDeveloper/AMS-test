"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Languages, ChevronRight } from "lucide-react";
import { initLiff, liffConfigured } from "@/lib/liff";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [lineChecking, setLineChecking] = useState(liffConfigured());

  // LINE Login (LIFF) — ทำงานเฉพาะเมื่อตั้งค่า NEXT_PUBLIC_LIFF_ID ไว้แล้ว
  useEffect(() => {
    if (!liffConfigured()) return;
    let cancelled = false;
    initLiff().then((profile) => {
      if (cancelled) return;
      if (profile) {
        router.replace("/dashboard");
      } else {
        setLineChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);


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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/dashboard");
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">{t("loginUsername")}</label>
              <input
                defaultValue="srt.field.001"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 transition"
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
                defaultValue="••••••••"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-govblue-700 to-govblue-600 hover:from-govblue-800 hover:to-govblue-700 text-white font-medium py-2.5 rounded-lg inline-flex items-center justify-center gap-2 shadow-sm hover:shadow transition"
            >
              {t("loginSignIn")} <ChevronRight size={16} />
            </button>
          </form>

          {liffConfigured() ? (
            <button
              type="button"
              onClick={() => {
                setLineChecking(true);
                initLiff();
              }}
              disabled={lineChecking}
              className="w-full mt-4 bg-[#06C755] hover:bg-[#05b34d] text-white font-medium py-2.5 rounded-lg inline-flex items-center justify-center gap-2 shadow-sm hover:shadow transition disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.2 2 1.5 5.9 1.5 10.7c0 4.3 3.9 7.9 9.2 8.6.4.1.9.2 1 .5.1.3.1.7 0 1l-.1.9c-.1.3-.2 1.1.9.6 1.2-.5 6.3-3.7 8.6-6.4 1.6-1.7 2.4-3.5 2.4-5.3C23.5 5.9 17.8 2 12 2z" />
              </svg>
              {lang === "th" ? "เข้าสู่ระบบด้วย LINE" : "Sign in with LINE"}
            </button>
          ) : (
            <p className="text-center text-[11px] text-gray-400 mt-4">
              {lang === "th"
                ? "โหมดสาธิต — ตั้งค่า NEXT_PUBLIC_LIFF_ID เพื่อเปิดใช้ LINE Login (ดู LINE-SETUP.md)"
                : "Demo mode — set NEXT_PUBLIC_LIFF_ID to enable LINE sign-in (see LINE-SETUP.md)"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
