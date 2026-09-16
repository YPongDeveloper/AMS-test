"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  fetchUsers,
  createUser,
  updateUser,
  resetUserPassword,
  getCurrentUser,
  type AppUser,
  type Role,
} from "@/lib/api";
import { Page } from "@/components/Page";
import {
  Users,
  UserPlus,
  ShieldCheck,
  KeyRound,
  Edit2,
  Search,
  AlertTriangle,
  X,
  CheckCircle2,
  Shield,
  Briefcase,
  Calculator,
} from "lucide-react";

const ROLE_META: Record<
  Role,
  { labelTh: string; labelEn: string; tone: string; icon: any }
> = {
  admin: {
    labelTh: "ผู้ดูแลระบบ",
    labelEn: "Administrator",
    tone: "bg-purple-100 text-purple-700 border-purple-200",
    icon: Shield,
  },
  supervisor: {
    labelTh: "หัวหน้างานสำรวจ",
    labelEn: "Supervisor",
    tone: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Briefcase,
  },
  subordinate: {
    labelTh: "เจ้าหน้าที่สำรวจภาคสนาม",
    labelEn: "Field Officer",
    tone: "bg-gray-100 text-gray-700 border-gray-200",
    icon: Users,
  },
  accountant: {
    labelTh: "พนักงานบัญชีและการเงิน",
    labelEn: "Accountant",
    tone: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: Calculator,
  },
};

export default function AdminPage() {
  const { lang } = useI18n();
  const th = lang === "th";
  const t = (thTxt: string, enTxt: string) => (th ? thTxt : enTxt);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Notifications
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [resettingUser, setResettingUser] = useState<AppUser | null>(null);

  // Form states
  const [addForm, setAddForm] = useState({
    username: "",
    password: "",
    display_name: "",
    role: "subordinate" as Role,
  });
  const [editForm, setEditForm] = useState({
    display_name: "",
    role: "subordinate" as Role,
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const currentUser = getCurrentUser();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "ไม่สามารถโหลดข้อมูลผู้ใช้ได้" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filtered list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = u.display_name.toLowerCase().includes(q);
        const matchesUsername = (u.username || "").toLowerCase().includes(q);
        if (!matchesName && !matchesUsername) return false;
      }
      return true;
    });
  }, [users, roleFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const total = users.length;
    const supervisors = users.filter((u) => u.role === "supervisor").length;
    const subordinates = users.filter((u) => u.role === "subordinate").length;
    const accountants = users.filter((u) => u.role === "accountant").length;
    return { total, supervisors, subordinates, accountants };
  }, [users]);

  // Handle Add User
  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.username.trim() || !addForm.password.trim() || !addForm.display_name.trim()) {
      setNotification({ type: "error", text: "กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง" });
      return;
    }
    if (addForm.password.length < 6) {
      setNotification({ type: "error", text: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร" });
      return;
    }

    setActionBusy(true);
    try {
      await createUser({
        username: addForm.username.trim(),
        password: addForm.password,
        display_name: addForm.display_name.trim(),
        role: addForm.role,
      });
      setNotification({ type: "success", text: `เพิ่มผู้ใช้ "${addForm.display_name}" เรียบร้อยแล้ว` });
      setIsAddOpen(false);
      setAddForm({ username: "", password: "", display_name: "", role: "subordinate" });
      await loadUsers();
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "ไม่สามารถเพิ่มผู้ใช้ได้" });
    } finally {
      setActionBusy(false);
    }
  }

  // Open Edit Modal
  function openEdit(u: AppUser) {
    setEditingUser(u);
    setEditForm({
      display_name: u.display_name,
      role: u.role,
    });
  }

  // Handle Edit Submit
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    if (!editForm.display_name.trim()) {
      setNotification({ type: "error", text: "ชื่อที่แสดงต้องไม่ว่างเปล่า" });
      return;
    }

    setActionBusy(true);
    try {
      await updateUser(editingUser.public_id, {
        display_name: editForm.display_name.trim(),
        role: editForm.role,
      });
      setNotification({ type: "success", text: `อัปเดตข้อมูลของ "${editForm.display_name}" สำเร็จ` });
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "ไม่สามารถบันทึกข้อมูลได้" });
    } finally {
      setActionBusy(false);
    }
  }

  // Handle Reset Password Submit
  async function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resettingUser) return;
    if (!newPassword || newPassword.length < 6) {
      setNotification({ type: "error", text: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotification({ type: "error", text: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" });
      return;
    }

    setActionBusy(true);
    try {
      await resetUserPassword(resettingUser.public_id, newPassword);
      setNotification({ type: "success", text: `รีเซ็ตรหัสผ่านของผู้ใช้ "${resettingUser.display_name}" เรียบร้อยแล้ว` });
      setResettingUser(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "ไม่สามารถรีเซ็ตรหัสผ่านได้" });
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <Page allowedRoles={["admin"]}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-govblue-100 text-govblue-800">
              <Users size={22} />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-govblue-900">
              {t("จัดการผู้ใช้งาน", "User Management")}
            </h1>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 bg-govblue-800 hover:bg-govblue-900 text-white font-medium text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition shrink-0"
          >
            <UserPlus size={16} />
            {t("เพิ่มผู้ใช้ใหม่", "Add User")}
          </button>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`p-4 rounded-xl text-xs sm:text-sm flex items-start justify-between gap-3 border shadow-xs ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle size={18} className="text-rose-600 flex-shrink-0" />
              )}
              <span>{notification.text}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              {t("ผู้ใช้ทั้งหมด", "Total Users")}
            </div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl border border-blue-200 bg-blue-50/20 p-4 shadow-xs">
            <div className="text-[11px] font-medium text-blue-700 uppercase tracking-wider flex items-center gap-1">
              <Briefcase size={13} className="text-blue-600" />
              {t("หัวหน้างาน", "Supervisors")}
            </div>
            <div className="text-2xl font-bold text-blue-800 mt-1">{stats.supervisors}</div>
          </div>
          <div className="bg-white rounded-xl border border-indigo-200 bg-indigo-50/20 p-4 shadow-xs">
            <div className="text-[11px] font-medium text-indigo-700 uppercase tracking-wider flex items-center gap-1">
              <Users size={13} className="text-indigo-600" />
              {t("เจ้าหน้าที่สำรวจ", "Field Officers")}
            </div>
            <div className="text-2xl font-bold text-indigo-800 mt-1">{stats.subordinates}</div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-xs">
            <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <Calculator size={13} className="text-emerald-600" />
              {t("พนักงานบัญชี", "Accountants")}
            </div>
            <div className="text-2xl font-bold text-emerald-800 mt-1">{stats.accountants}</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("ค้นหาด้วยชื่อ หรือ ชื่อผู้ใช้ (username)...", "Search by name or username...")}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-govblue-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 whitespace-nowrap">{t("บทบาท:", "Role:")}</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-govblue-500"
              >
                <option value="all">{t("ทุกบทบาท", "All Roles")}</option>
                <option value="admin">{t("ผู้ดูแลระบบ (Admin)", "Admin")}</option>
                <option value="supervisor">{t("หัวหน้างาน (Supervisor)", "Supervisor")}</option>
                <option value="subordinate">{t("เจ้าหน้าที่สำรวจ (Field Officer)", "Field Officer")}</option>
                <option value="accountant">{t("พนักงานบัญชี (Accountant)", "Accountant")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* User Table / List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-xs sm:text-sm animate-pulse">
              {t("กำลังโหลดรายชื่อผู้ใช้...", "Loading users...")}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-xs sm:text-sm">
              {t("ไม่พบรายชื่อผู้ใช้ที่ตรงกับเงื่อนไข", "No users found matching filter")}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredUsers.map((u) => {
                const meta = ROLE_META[u.role] || ROLE_META.subordinate;
                const RoleIcon = meta.icon;
                const isSelf = currentUser?.public_id === u.public_id;

                return (
                  <div
                    key={u.public_id}
                    className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:bg-gray-50/50"
                  >
                    {/* User Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      {u.picture_url ? (
                        <img
                          src={u.picture_url}
                          alt=""
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-govblue-200"
                        />
                      ) : (
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${
                            u.role === "accountant"
                              ? "bg-emerald-100 text-emerald-700"
                              : u.role === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-govblue-100 text-govblue-800"
                          }`}
                        >
                          {u.display_name.charAt(0)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">
                            {u.display_name}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] bg-govblue-50 text-govblue-700 px-2 py-0.5 rounded-full font-medium border border-govblue-200">
                              {t("คุณเอง", "You")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span>{u.username ? `@${u.username}` : t("บัญชีเชื่อมต่อ LINE", "LINE Account")}</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <RoleIcon size={12} className="text-gray-400" />
                            {th ? meta.labelTh : meta.labelEn}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Role & Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                      <span className={`hidden md:inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium border ${meta.tone}`}>
                        <RoleIcon size={12} />
                        {th ? meta.labelTh : meta.labelEn}
                      </span>

                      {/* Edit Button */}
                      <button
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-govblue-800 bg-white hover:bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-lg transition"
                        title={t("แก้ไขข้อมูล", "Edit User")}
                      >
                        <Edit2 size={13} />
                        <span className="hidden sm:inline">{t("แก้ไข", "Edit")}</span>
                      </button>

                      {/* Reset Password Button */}
                      <button
                        onClick={() => {
                          setResettingUser(u);
                          setNewPassword("");
                          setConfirmPassword("");
                        }}
                        className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg transition"
                        title={t("รีเซ็ตรหัสผ่าน", "Reset Password")}
                      >
                        <KeyRound size={13} />
                        <span className="hidden sm:inline">{t("รหัสผ่าน", "Password")}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Security & Integrity Note */}
        <div className="rounded-xl border border-govblue-200 bg-govblue-50/70 p-4 text-xs text-govblue-900 flex items-start gap-3">
          <ShieldCheck size={20} className="text-govblue-700 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold">{t("มาตรฐานความปลอดภัยของข้อมูล (Security Standards)", "Security Standards")}</div>
            <p className="text-govblue-800 leading-relaxed">
              {t(
                "ระบบใช้การควบคุมสิทธิ์ตามบทบาท (Role-Based Access Control) เพื่อความปลอดภัยและการเข้าถึงข้อมูลตามขอบเขตหน้าที่อย่างรัดกุม รหัสผ่านทั้งหมดได้รับการเข้ารหัสความปลอดภัยระดับสูง",
                "The system enforces Role-Based Access Control (RBAC) to ensure secure access to data based on organizational responsibilities. All passwords are encrypted using high-standard security algorithms.",
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ================= MODAL: ADD USER ================= */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsAddOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-govblue-900 font-bold text-base">
                <UserPlus size={18} className="text-govblue-700" />
                {t("เพิ่มผู้ใช้งานใหม่", "Create New User")}
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("ชื่อผู้ใช้ (Username สำหรับเข้าสู่ระบบ)", "Username (for login)")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                  placeholder="เช่น somchai.k"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-govblue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("ชื่อ-นามสกุล / ชื่อที่แสดง", "Display Name / Full Name")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addForm.display_name}
                  onChange={(e) => setAddForm({ ...addForm, display_name: e.target.value })}
                  placeholder="เช่น สมชาย ใจดี"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-govblue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("รหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัวอักษร)", "Initial Password (min 6 chars)")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-govblue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("บทบาทและสิทธิ์ (Role)", "Role & Permissions")} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value as Role })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-govblue-500"
                >
                  <option value="subordinate">{t("เจ้าหน้าที่สำรวจภาคสนาม (Field Officer)", "Field Officer")}</option>
                  <option value="supervisor">{t("หัวหน้างานสำรวจ (Supervisor)", "Supervisor")}</option>
                  <option value="accountant">{t("พนักงานบัญชีและการเงิน (Accountant)", "Accountant")}</option>
                  <option value="admin">{t("ผู้ดูแลระบบ (Administrator)", "Administrator")}</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  {addForm.role === "accountant"
                    ? t("พนักงานบัญชี: ดูข้อมูลที่ดิน สิ่งปลูกสร้าง และคำนวณภาษีรวมได้ แต่ไม่สามารถจัดการผู้ใช้หรือสั่งงานได้", "Accountant: Access Land, Building, and Tax, cannot manage users or tasks")
                    : addForm.role === "admin"
                    ? t("ผู้ดูแลระบบ: เข้าถึงได้ทุกระบบ รวมถึงการจัดการผู้ใช้", "Admin: Full access including user management")
                    : addForm.role === "supervisor"
                    ? t("หัวหน้างาน: สั่งงานสำรวจ ดูแผนที่ และตรวจสอบงานได้", "Supervisor: Create & assign tasks, inspect map")
                    : t("เจ้าหน้าที่: ปฏิบัติงานสำรวจตามที่ได้รับมอบหมาย", "Field Officer: View and execute assigned tasks")}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 rounded-xl border border-gray-200 transition"
                >
                  {t("ยกเลิก", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-medium text-white bg-govblue-800 hover:bg-govblue-900 rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {actionBusy ? t("กำลังบันทึก...", "Saving...") : t("บันทึกผู้ใช้", "Create User")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT USER ================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-govblue-900 font-bold text-base">
                <Edit2 size={18} className="text-govblue-700" />
                {t("แก้ไขข้อมูลผู้ใช้", "Edit User Info")}
              </div>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t("ชื่อผู้ใช้ (Username)", "Username")}
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-600 font-mono">
                  {editingUser.username || "LINE User"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("ชื่อ-นามสกุล / ชื่อที่แสดง", "Display Name / Full Name")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.display_name}
                  onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-govblue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("บทบาทและสิทธิ์ (Role)", "Role & Permissions")}
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-govblue-500"
                >
                  <option value="subordinate">{t("เจ้าหน้าที่สำรวจภาคสนาม (Field Officer)", "Field Officer")}</option>
                  <option value="supervisor">{t("หัวหน้างานสำรวจ (Supervisor)", "Supervisor")}</option>
                  <option value="accountant">{t("พนักงานบัญชีและการเงิน (Accountant)", "Accountant")}</option>
                  <option value="admin">{t("ผู้ดูแลระบบ (Administrator)", "Administrator")}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 rounded-xl border border-gray-200 transition"
                >
                  {t("ยกเลิก", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-medium text-white bg-govblue-800 hover:bg-govblue-900 rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {actionBusy ? t("กำลังบันทึก...", "Saving...") : t("บันทึกการเปลี่ยนแปลง", "Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESET PASSWORD ================= */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResettingUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-govblue-900 font-bold text-base">
                <KeyRound size={18} className="text-amber-600" />
                {t("รีเซ็ตรหัสผ่าน", "Reset Password")}
              </div>
              <button onClick={() => setResettingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              {t("ตั้งรหัสผ่านใหม่สำหรับผู้ใช้:", "Set new password for:")}{" "}
              <span className="font-semibold text-gray-800">{resettingUser.display_name}</span>{" "}
              {resettingUser.username ? `(@${resettingUser.username})` : ""}
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)", "New Password (min 6 chars)")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-govblue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("ยืนยันรหัสผ่านใหม่อีกครั้ง", "Confirm New Password")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-govblue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 rounded-xl border border-gray-200 transition"
                >
                  {t("ยกเลิก", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {actionBusy ? t("กำลังตั้งค่า...", "Setting...") : t("รีเซ็ตรหัสผ่าน", "Reset Password")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Page>
  );
}
