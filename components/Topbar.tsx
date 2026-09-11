"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Wifi, WifiOff, Languages } from "lucide-react";
import { useEffect, useState } from "react";

export function Topbar() {
  const { t, lang, setLang } = useI18n();
  const pathname = usePathname();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const navItems = [
    { href: "/dashboard", key: "navDashboard" },
    { href: "/land", key: "navLand" },
    { href: "/building", key: "navBuilding" },
    { href: "/tax", key: "navTax" },
  ];

  return (
    <header className="gov-pattern text-white">
      <div className="border-b border-govgold-500/30">
        <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-govgold-400">
            <span className="inline-block w-2 h-2 rounded-full bg-govgold-500" />
            <span className="tracking-wider">{t("orgSub")}</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                online ? "bg-emerald-600/20 text-emerald-200" : "bg-amber-600/30 text-amber-100"
              }`}
            >
              {online ? <Wifi size={12} /> : <WifiOff size={12} />}
              {online ? t("online") : t("offline")}
            </span>
            <button
              onClick={() => setLang(lang === "th" ? "en" : "th")}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-govblue-700/60 hover:bg-govblue-600/80 text-[11px]"
            >
              <Languages size={12} /> {lang === "th" ? "EN" : "TH"}
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-govgold-500/95 flex items-center justify-center font-bold text-govblue-800 text-lg shadow ring-2 ring-govgold-400/60">
          รฟ
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base sm:text-lg font-semibold leading-tight">{t("orgName")}</div>
          <div className="text-xs sm:text-sm text-govgold-400 truncate">{t("appTitle")}</div>
        </div>
      </div>
      <nav className="bg-govblue-700/95">
        <div className="mx-auto max-w-6xl px-2 flex overflow-x-auto">
          {navItems.map((it) => {
            const active = pathname?.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition ${
                  active
                    ? "border-govgold-400 text-white bg-govblue-600/60"
                    : "border-transparent text-blue-100 hover:bg-govblue-600/40"
                }`}
              >
                {t(it.key)}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
