"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Languages, ChevronRight } from "lucide-react";

export default function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();

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
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-govblue-700 to-govblue-600 flex items-center justify-center text-govgold-400 font-bold text-2xl shadow-lg ring-4 ring-white">
            รฟ
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
        </div>
      </div>
    </div>
  );
}
