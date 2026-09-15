"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Wifi, WifiOff, Languages, Search, Bell, User, ChevronDown, Smartphone, LogOut, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { clearTokens, getCurrentUser, logout, type AppUser } from "@/lib/api";
import { usePwaInstall } from "@/lib/usePwaInstall";

export function Topbar() {
  const { t, lang, setLang } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { canInstall, promptInstall } = usePwaInstall();

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

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

  // ปิด dropdown เมื่อคลิกนอก
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const isOfficer = user?.role === "subordinate";
  const tasksLabel = isOfficer ? t("navMyTasks") : t("navTasks");

  const homeHref =
    user?.role === "accountant"
      ? "/tax"
      : user?.role === "subordinate" || user?.role === "supervisor"
        ? "/tasks"
        : "/dashboard";

  const navItems = [
    { href: "/dashboard", label: t("navDashboard"), roles: ["admin", "supervisor"] },
    { href: "/tasks", label: tasksLabel, roles: ["admin", "supervisor", "subordinate"] },
    { href: "/land", label: t("navLand"), roles: ["admin"] },
    { href: "/building", label: t("navBuilding"), roles: ["admin"] },
    { href: "/tax", label: t("navTax"), roles: ["admin", "accountant"] },
    { href: "/admin", label: t("navAdmin"), roles: ["admin"] },
  ].filter((it) => user && it.roles.includes(user.role));

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    setUser(null);
    router.push("/");
  }

  async function handleInstall() {
    const result = await promptInstall();
    if (result === "manual") {
      alert(
        lang === "th"
          ? "บน iPhone/iPad: กดปุ่มแชร์ (Share) ด้านล่าง แล้วเลือก “เพิ่มลงหน้าจอหลัก”"
          : "On iOS: tap the Share button, then choose “Add to Home Screen”"
      );
    }
    setMenuOpen(false);
  }

  const displayName = user?.display_name || t("officerName");
  const roleLabel =
    user?.role === "admin"
      ? lang === "th" ? "ผู้ดูแลระบบ" : "Administrator"
      : user?.role === "supervisor"
        ? lang === "th" ? "หัวหน้างาน" : "Supervisor"
        : user?.role === "accountant"
          ? lang === "th" ? "พนักงานบัญชี" : "Accountant"
          : lang === "th" ? "เจ้าหน้าที่" : "Officer";

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      {/* Row 1: utility (online + lang) */}
      <div className="bg-gradient-to-r from-govblue-800 to-govblue-700 text-white">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 py-1.5 flex items-center justify-end text-[11px] sm:text-xs">
          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                online ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/30 text-amber-100"
              }`}
            >
              {online ? <Wifi size={11} /> : <WifiOff size={11} />}
              <span className="hidden sm:inline">{online ? t("online") : t("offline")}</span>
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
        <Link href={homeHref} className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-govblue-700 to-govblue-600 flex items-center justify-center shadow-sm">
            <Logo className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
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

          {/* Profile + dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 py-1 rounded-lg hover:bg-gray-100"
            >
              {user?.picture_url ? (
                <img
                  src={user.picture_url}
                  alt=""
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shadow-sm ring-1 ring-gray-200"
                />
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-govblue-600 to-govblue-700 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                  {user?.display_name ? user.display_name.charAt(0) : <User size={16} />}
                </div>
              )}
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-xs font-semibold text-gray-800">{displayName}</div>
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition ${menuOpen ? "rotate-180" : ""}`} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                {/* user header */}
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <div className="text-sm font-semibold text-gray-800 truncate">{displayName}</div>
                  <div className="text-[11px] text-govblue-600 font-medium">{roleLabel}</div>
                </div>

                {user?.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Settings size={15} /> {t("manageUsers")}
                  </Link>
                )}

                {canInstall && (
                  <button
                    onClick={handleInstall}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <Smartphone size={15} /> {t("installMobile")}
                  </button>
                )}

                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 text-left"
                >
                  <LogOut size={15} /> {t("logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: nav menu (ซ่อนสำหรับพนักงานบัญชี ให้แสดงเฉพาะหน้าคำนวณภาษี) */}
      {user?.role !== "accountant" && navItems.length > 0 && (
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
                  {it.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
