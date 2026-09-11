"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Languages, Wifi, Building2 } from "lucide-react";

export default function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center gov-pattern p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="text-[11px] text-govgold-400 flex items-center gap-1">
          <Wifi size={12} /> {t("online")}
        </span>
        <button
          onClick={() => setLang(lang === "th" ? "en" : "th")}
          className="flex items-center gap-1 px-2 py-1 rounded bg-govblue-700/80 text-white text-xs"
        >
          <Languages size={12} /> {lang === "th" ? "EN" : "TH"}
        </button>
      </div>
      <div className="w-full max-w-md bg-white rounded-md shadow-xl overflow-hidden">
        <div className="gov-pattern text-center py-6 text-white">
          <div className="mx-auto w-16 h-16 rounded-full bg-govgold-500 flex items-center justify-center text-govblue-800 font-bold text-2xl mb-2 ring-4 ring-govgold-400/50">
            รฟ
          </div>
          <div className="text-sm tracking-wider text-govgold-400">{t("orgSub")}</div>
          <div className="text-lg font-semibold mt-1">{t("orgName")}</div>
          <div className="text-xs text-govgold-400 mt-1">{t("appTitle")}</div>
        </div>
        <div className="p-6">
          <h1 className="text-lg font-semibold text-govblue-700 mb-1">{t("loginTitle")}</h1>
          <p className="text-xs text-gray-500 mb-4">{t("loginSub")}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/dashboard");
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{t("loginUsername")}</label>
              <input
                defaultValue="srt.field.001"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-govblue-500/30 focus:border-govblue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{t("loginPassword")}</label>
              <input
                type="password"
                defaultValue="••••••••"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-govblue-500/30 focus:border-govblue-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">{t("loginHint")}</p>
            </div>
            <button
              type="submit"
              className="w-full bg-govblue-700 hover:bg-govblue-600 text-white font-medium py-2.5 rounded inline-flex items-center justify-center gap-2"
            >
              <Building2 size={16} /> {t("loginSignIn")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
