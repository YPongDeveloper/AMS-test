"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Wifi, WifiOff, Languages, Search, Bell, User } from "lucide-react";
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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      {/* Row 1: utility (online + lang) */}
      <div className="bg-gradient-to-r from-govblue-800 to-govblue-700 text-white">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 py-1.5 flex items-center justify-between text-[11px] sm:text-xs">
          <div className="flex items-center gap-2 text-govgold-300">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-govgold-400" />
            <span className="tracking-wider hidden sm:inline">{t("orgSub")}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                online ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/30 text-amber-100"
              }`}
            >
              {online ? <Wifi size={11} /> : <WifiOff size={11} />}
              <span className="hidden xs:inline">{online ? t("online") : t("offline")}</span>
            </span>
            <button
              onClick={() => setLang(lang === "th" ? "en" : "th")}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[11px]"
            >
              <Languages size={11} /> {lang === "th" ? "EN" : "TH"}
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: logo + search + user */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-3 flex items-center gap-3 sm:gap-6">
        <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-govblue-700 to-govblue-600 flex items-center justify-center font-bold text-govgold-400 text-base sm:text-lg shadow-sm">
            รฟ
          </div>
          <div className="min-w-0 hidden sm:block">
            <div className="text-sm sm:text-base font-semibold text-govblue-800 leading-tight truncate">
              {t("orgName")}
            </div>
            <div className="text-[11px] text-govblue-500 truncate">{t("appTitle")}</div>
          </div>
        </Link>

        {/* Search — hidden on mobile */}
        <div className="hidden md:flex flex-1 max-w-md mx-auto">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={lang === "th" ? "ค้นหาแปลงที่ดิน อาคาร รหัส..." : "Search parcels, buildings, code..."}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            aria-label="Notifications"
            className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
          </button>
          <button className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 py-1 rounded-lg hover:bg-gray-100">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-govblue-600 to-govblue-700 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
              <User size={16} />
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-xs font-semibold text-gray-800">เจ้าหน้าที่ สนาม</div>
              <div className="text-[10px] text-gray-500">srt.field.001</div>
            </div>
          </button>
        </div>
      </div>

      {/* Row 3: nav menu */}
      <nav className="bg-gray-50 border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-2 sm:px-6 flex overflow-x-auto">
          {navItems.map((it) => {
            const active = pathname?.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition ${
                  active
                    ? "border-govblue-700 text-govblue-700 font-semibold"
                    : "border-transparent text-gray-600 hover:text-govblue-700 hover:bg-white"
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
