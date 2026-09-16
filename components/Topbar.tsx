"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  User,
  ChevronDown,
  Smartphone,
  LogOut,
  Settings,
  KeyRound,
  X,
  CheckCircle2,
  AlertCircle,
  Shield,
  Briefcase,
  Users,
  Calculator,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import {
  getCurrentUser,
  saveCurrentUser,
  updateUser,
  resetUserPassword,
  logout,
  type AppUser,
} from "@/lib/api";
import { usePwaInstall } from "@/lib/usePwaInstall";
import { NotificationCenter } from "./NotificationCenter";

export function Topbar() {
  const { t, lang, setLang } = useI18n();
  const th = lang === "th";
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AppUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { canInstall, promptInstall } = usePwaInstall();

  // Profile Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Password Modal State
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    if (u) setProfileName(u.display_name || "");
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
    user?.role === "admin"
      ? "/admin"
      : user?.role === "accountant"
        ? "/tax"
        : "/tasks";

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
        th
          ? "บน iPhone/iPad: กดปุ่มแชร์ (Share) ด้านล่าง แล้วเลือก “เพิ่มลงหน้าจอหลัก”"
          : "On iOS: tap the Share button, then choose “Add to Home Screen”"
      );
    }
    setMenuOpen(false);
  }

  // Handle Save Profile
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!profileName.trim()) {
      setProfileNotice(th ? "กรุณาระบุชื่อที่แสดง" : "Please enter display name");
      return;
    }
    setProfileSaving(true);
    setProfileNotice(null);
    try {
      await updateUser(user.public_id, {
        display_name: profileName.trim(),
        role: user.role,
        status: user.status || "active",
      });
      const updated = { ...user, display_name: profileName.trim() };
      saveCurrentUser(updated);
      setUser(updated);
      setProfileNotice(th ? "บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว" : "Profile updated successfully");
      window.dispatchEvent(new Event("ams_data_updated"));
      setTimeout(() => {
        setProfileModalOpen(false);
        setProfileNotice(null);
      }, 1200);
    } catch (err: any) {
      setProfileNotice(err?.message || (th ? "บันทึกไม่สำเร็จ" : "Failed to update profile"));
    } finally {
      setProfileSaving(false);
    }
  }

  // Handle Save Password
  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setPasswordError(null);
    setPasswordNotice(null);

    if (!newPassword) {
      setPasswordError(th ? "กรุณาระบุรหัสผ่านใหม่" : "Please enter a new password");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError(th ? "รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร" : "Password must be at least 4 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(th ? "รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน" : "Passwords do not match");
      return;
    }

    setPasswordSaving(true);
    try {
      await resetUserPassword(user.public_id, newPassword);
      setPasswordNotice(th ? "เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว" : "Password changed successfully");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordNotice(null);
      }, 1500);
    } catch (err: any) {
      setPasswordError(err?.message || (th ? "เปลี่ยนรหัสผ่านไม่สำเร็จ" : "Failed to change password"));
    } finally {
      setPasswordSaving(false);
    }
  }

  const displayName = user?.display_name || t("officerName");
  const roleLabel =
    user?.role === "admin"
      ? th ? "ผู้ดูแลระบบ" : "Administrator"
      : user?.role === "supervisor"
        ? th ? "หัวหน้างาน" : "Supervisor"
        : user?.role === "accountant"
          ? th ? "พนักงานบัญชี" : "Accountant"
          : th ? "เจ้าหน้าที่สำรวจ" : "Survey Officer";

  const RoleIcon =
    user?.role === "admin"
      ? Shield
      : user?.role === "supervisor"
      ? Briefcase
      : user?.role === "accountant"
      ? Calculator
      : Users;

  return (
    <>
      <header className="bg-govblue-900 border-b border-govblue-950 sticky top-0 z-30 shadow-md text-white w-full">
        {/* Main Header Bar (Navy Blue Theme) */}
        <div className="mx-auto max-w-7xl px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
          {/* Brand */}
          <Link href={homeHref} className="flex items-center gap-2 sm:gap-3 shrink min-w-0 group">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-sm text-govgold-400 group-hover:bg-white/15 transition shrink-0">
              <Logo className="w-6 h-6 sm:w-7 sm:h-7 text-govgold-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                {t("orgName")}
              </div>
              <div className="text-[10px] sm:text-[11px] text-govgold-300 truncate font-medium">
                {t("appTitle")}
              </div>
            </div>
          </Link>

          {/* Right actions: Notification -> Language Switcher -> Profile */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-auto">
            {/* 1. Notifications Center */}
            <NotificationCenter currentUser={user} theme="dark" />

            {/* 2. Language Switcher (ก่อนหน้าไอคอนโปรไฟล์ หลัง notification) */}
            <div className="inline-flex rounded-lg border border-white/20 bg-govblue-950/50 p-0.5 text-xs font-semibold shadow-2xs">
              <button
                type="button"
                onClick={() => setLang("th")}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  lang === "th"
                    ? "bg-white text-govblue-900 font-bold shadow-xs"
                    : "text-blue-200 hover:text-white"
                }`}
                title="สลับเป็นภาษาไทย"
              >
                TH
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  lang === "en"
                    ? "bg-white text-govblue-900 font-bold shadow-xs"
                    : "text-blue-200 hover:text-white"
                }`}
                title="Switch to English"
              >
                EN
              </button>
            </div>

            {/* 3. Profile Button & Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 py-1 rounded-xl hover:bg-white/10 transition text-white cursor-pointer"
              >
                {user?.picture_url ? (
                  <img
                    src={user.picture_url}
                    alt=""
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shadow-sm ring-2 ring-white/30"
                  />
                ) : (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-govgold-400 to-govgold-600 flex items-center justify-center text-govblue-950 text-sm font-bold shadow-sm ring-2 ring-white/20">
                    {user?.display_name ? user.display_name.charAt(0) : <User size={16} />}
                  </div>
                )}
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-semibold text-white truncate max-w-[140px]">{displayName}</div>
                  <div className="text-[10px] text-blue-200">{roleLabel}</div>
                </div>
                <ChevronDown size={14} className={`text-blue-200 transition ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-gray-800">
                  {/* User Header */}
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                    <div className="text-sm font-bold text-gray-900 truncate">{displayName}</div>
                    <div className="text-xs text-govblue-700 font-medium flex items-center gap-1 mt-0.5">
                      <RoleIcon size={13} className="text-govblue-600" />
                      <span>{roleLabel}</span>
                      <span className="text-gray-400 font-normal">(@{user?.username || "user"})</span>
                    </div>
                  </div>

                  <div className="py-1">
                    {/* จัดการโปรไฟล์ผู้ใช้ */}
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setProfileName(user?.display_name || "");
                        setProfileNotice(null);
                        setProfileModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm text-gray-700 hover:bg-govblue-50 hover:text-govblue-900 transition text-left cursor-pointer"
                    >
                      <User size={15} className="text-govblue-700" />
                      <span>{th ? "จัดการโปรไฟล์ผู้ใช้" : "Manage Profile"}</span>
                    </button>

                    {/* จัดการรหัสผ่าน */}
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setNewPassword("");
                        setConfirmPassword("");
                        setPasswordError(null);
                        setPasswordNotice(null);
                        setPasswordModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm text-gray-700 hover:bg-govblue-50 hover:text-govblue-900 transition text-left cursor-pointer"
                    >
                      <KeyRound size={15} className="text-govblue-700" />
                      <span>{th ? "จัดการรหัสผ่าน" : "Change Password"}</span>
                    </button>

                    {canInstall && (
                      <button
                        onClick={handleInstall}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm text-gray-700 hover:bg-govblue-50 hover:text-govblue-900 text-left transition cursor-pointer"
                      >
                        <Smartphone size={15} className="text-govblue-700" />
                        <span>{t("installMobile")}</span>
                      </button>
                    )}
                  </div>

                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm text-rose-600 hover:bg-rose-50 text-left transition cursor-pointer"
                  >
                    <LogOut size={15} />
                    <span>{t("logout")}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 1. Modal จัดการโปรไฟล์ผู้ใช้ (Manage Profile Modal)        */}
      {/* ========================================================= */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150 text-gray-800">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-govblue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-govgold-400">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold">
                    {th ? "จัดการโปรไฟล์ผู้ใช้" : "Manage Profile"}
                  </h3>
                  <p className="text-[11px] text-blue-200">
                    {th ? "แก้ไขข้อมูลส่วนตัวและชื่อที่แสดงในระบบ" : "Update your display information"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProfile} className="p-5 space-y-4 text-xs sm:text-sm">
              {profileNotice && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    profileNotice.includes("เรียบร้อย") || profileNotice.includes("successfully")
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {profileNotice.includes("เรียบร้อย") || profileNotice.includes("successfully") ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  )}
                  <span>{profileNotice}</span>
                </div>
              )}

              {/* Username (Read-only) */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1 text-xs">
                  {th ? "ชื่อผู้ใช้ / รหัสพนักงาน (Username)" : "Username / Employee ID"}
                </label>
                <input
                  type="text"
                  value={user?.username || ""}
                  disabled
                  className="w-full px-3 py-2 text-xs bg-gray-100 border border-gray-200 rounded-lg text-gray-500 font-mono cursor-not-allowed"
                />
              </div>

              {/* Role (Read-only badge) */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1 text-xs">
                  {th ? "บทบาทและสิทธิ์การใช้งาน (System Role)" : "System Role"}
                </label>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-govblue-50 border border-govblue-200">
                  <RoleIcon size={16} className="text-govblue-700" />
                  <span className="font-bold text-govblue-900 text-xs">{roleLabel}</span>
                  <span className="text-[10px] text-govblue-600 ml-auto bg-white px-2 py-0.5 rounded border border-govblue-200">
                    {user?.status === "active" ? (th ? "ปกติ (Active)" : "Active") : (th ? "ระงับ" : "Inactive")}
                  </span>
                </div>
              </div>

              {/* Display Name (Editable) */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1 text-xs">
                  {th ? "ชื่อ-นามสกุล / ชื่อที่แสดงในระบบ (Display Name)" : "Display Name"}
                  <span className="text-rose-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder={th ? "เช่น นายสมชาย สำรวจดี" : "e.g. Somchai Survey"}
                  required
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 transition"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  {th ? "ชื่อนี้จะแสดงในการสั่งงาน รายงานผลสำรวจ และเอกสารต่างๆ" : "This name will be used across task assignments and reports"}
                </span>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                >
                  {th ? "ยกเลิก" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-govblue-800 hover:bg-govblue-900 rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                >
                  <Save size={14} />
                  <span>{profileSaving ? (th ? "กำลังบันทึก..." : "Saving...") : (th ? "บันทึกข้อมูล" : "Save Changes")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. Modal จัดการรหัสผ่าน (Change Password Modal)             */}
      {/* ========================================================= */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150 text-gray-800">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-govblue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-govgold-400">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold">
                    {th ? "จัดการรหัสผ่าน" : "Change Password"}
                  </h3>
                  <p className="text-[11px] text-blue-200">
                    {th ? "เปลี่ยนรหัสผ่านเพื่อความปลอดภัยของบัญชี" : "Set a new password for your account"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPasswordModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePassword} className="p-5 space-y-4 text-xs sm:text-sm">
              {passwordNotice && (
                <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{passwordNotice}</span>
                </div>
              )}
              {passwordError && (
                <div className="p-3 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {/* Username Info */}
              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-xs text-gray-600 flex items-center justify-between">
                <span>{th ? "บัญชีผู้ใช้:" : "Account:"}</span>
                <span className="font-bold text-gray-900 font-mono">@{user?.username}</span>
              </div>

              {/* New Password */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1 text-xs">
                  {th ? "รหัสผ่านใหม่" : "New Password"}
                  <span className="text-rose-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={th ? "ระบุรหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)" : "Enter new password (min 4 chars)"}
                    required
                    className="w-full px-3 py-2 pr-9 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1 text-xs">
                  {th ? "ยืนยันรหัสผ่านใหม่อีกครั้ง" : "Confirm New Password"}
                  <span className="text-rose-500 ml-0.5">*</span>
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={th ? "กรอกรหัสผ่านใหม่อีกครั้งให้ตรงกัน" : "Confirm new password"}
                  required
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 transition"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                >
                  {th ? "ยกเลิก" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-govblue-800 hover:bg-govblue-900 rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                >
                  <KeyRound size={14} />
                  <span>{passwordSaving ? (th ? "กำลังเปลี่ยน..." : "Updating...") : (th ? "เปลี่ยนรหัสผ่าน" : "Change Password")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
