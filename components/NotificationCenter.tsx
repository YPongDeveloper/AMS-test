"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Users,
  AlertCircle,
  FileCheck2,
  ClipboardList,
  CheckCircle2,
  RotateCcw,
  Check,
  X,
  CheckCheck,
  ExternalLink,
  Clock,
  Inbox,
} from "lucide-react";
import {
  getCurrentUser,
  fetchMyInvitations,
  fetchMyTeam,
  respondToInvitation,
  fetchRevisionRequests,
  fetchTasksList,
  type AppUser,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export interface NotificationAction {
  label: string;
  actionType: "accept_invite" | "decline_invite" | "navigate";
  link?: string;
  variant: "primary" | "secondary" | "success" | "danger" | "purple" | "amber";
}

export interface NotificationItem {
  id: string;
  type: "invitation" | "revision_request" | "submission_review" | "task_assigned" | "task_approved" | "task_rejected";
  title: string;
  message: string;
  time: string;
  link: string;
  badge: {
    label: string;
    bg: string;
    text: string;
  };
  actions?: NotificationAction[];
  data?: any;
}

function timeAgo(isoString: string, lang: "th" | "en" = "th"): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return lang === "th" ? "เมื่อสักครู่" : "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return lang === "th" ? `${diffMin} นาทีที่แล้ว` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return lang === "th" ? `${diffHours} ชั่วโมงที่แล้ว` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return lang === "th" ? "เมื่อวานนี้" : "Yesterday";
    if (diffDays < 7) return lang === "th" ? `${diffDays} วันที่แล้ว` : `${diffDays}d ago`;

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = lang === "th" ? d.getFullYear() + 543 : d.getFullYear();
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${day}/${month}/${year} ${time}`;
  } catch {
    return "";
  }
}

export function NotificationCenter({
  currentUser,
  theme = "light",
}: {
  currentUser?: AppUser | null;
  theme?: "light" | "dark";
}) {
  const { lang } = useI18n();
  const th = lang === "th";
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<AppUser | null>(currentUser || null);

  useEffect(() => {
    if (currentUser !== undefined) {
      setUser(currentUser);
    } else {
      setUser(getCurrentUser());
    }
  }, [currentUser]);

  useEffect(() => {
    const handleAuth = () => {
      setUser(getCurrentUser());
    };
    window.addEventListener("storage", handleAuth);
    window.addEventListener("ams_data_updated", handleAuth);
    return () => {
      window.removeEventListener("storage", handleAuth);
      window.removeEventListener("ams_data_updated", handleAuth);
    };
  }, []);

  useEffect(() => {
    const activeUser = user || getCurrentUser();
    if (!activeUser) return;
    try {
      const stored = localStorage.getItem(`ams_read_notifs_${activeUser.public_id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setReadIds(parsed);
      }
    } catch {}
  }, [user]);

  const markAsRead = useCallback(
    (id: string) => {
      const activeUser = user || getCurrentUser();
      if (!activeUser) return;
      setReadIds((prev) => {
        if (prev.includes(id)) return prev;
        const updated = [...prev, id];
        try {
          localStorage.setItem(`ams_read_notifs_${activeUser.public_id}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [user]
  );

  const markAllAsRead = useCallback(() => {
    const activeUser = user || getCurrentUser();
    if (!activeUser) return;
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    try {
      localStorage.setItem(`ams_read_notifs_${activeUser.public_id}`, JSON.stringify(allIds));
    } catch {}
  }, [user, notifications]);

  const loadNotifications = useCallback(async () => {
    const activeUser = user || getCurrentUser();
    if (!activeUser) return;
    setLoading(true);

    try {
      const items: NotificationItem[] = [];
      const isSup = activeUser.role === "supervisor" || activeUser.role === "admin";
      const isOfficer = activeUser.role === "subordinate";

      // 1. Team Invitations (สำหรับลูกน้อง/ผู้ถูกเชิญ)
      if (isOfficer) {
        try {
          const invitations = await fetchMyInvitations();
          for (const inv of Array.isArray(invitations) ? invitations : []) {
            if (inv && inv.status === "pending") {
              const id = `inv-${inv.id || inv.supervisor_public_id}`;
              items.push({
                id,
                type: "invitation",
                title: th ? "คำเชิญเข้าร่วมทีมสำรวจ (Team Invitation)" : "Team Invitation",
                message: th
                  ? `หัวหน้างาน ${inv.supervisor_name} ได้ส่งคำเชิญให้ท่านเข้าร่วมทีมสำรวจ`
                  : `Supervisor ${inv.supervisor_name} invited you to join the survey team.`,
                time: inv.invited_at || new Date().toISOString(),
                link: "/tasks?open=team",
                badge: {
                  label: th ? "คำเชิญทีม" : "Team Invite",
                  bg: "bg-blue-100",
                  text: "text-blue-800",
                },
                actions: [
                  {
                    label: th ? "ยอมรับ" : "Accept",
                    actionType: "accept_invite",
                    variant: "success",
                  },
                  {
                    label: th ? "ปฏิเสธ" : "Decline",
                    actionType: "decline_invite",
                    variant: "secondary",
                  },
                ],
                data: inv,
              });
            }
          }
        } catch {}
      }

      // 2. Team Member Responses (สำหรับหัวหน้างาน: เมื่อลูกน้องกดยอมรับหรือปฏิเสธคำเชิญ)
      if (isSup) {
        try {
          const team = await fetchMyTeam();
          for (const m of Array.isArray(team) ? team : []) {
            if (!m) continue;
            if (m.status === "accepted" && m.responded_at) {
              const id = `team-accepted-${m.subordinate_public_id}-${m.responded_at}`;
              items.push({
                id,
                type: "task_approved",
                title: th ? "สมาชิกตอบรับเข้าร่วมทีมแล้ว" : "Team Member Joined",
                message: th
                  ? `คุณ ${m.subordinate_name || m.subordinate_username} (@${m.subordinate_username}) ได้กดยอมรับคำเชิญและเข้าร่วมทีมสำรวจของคุณแล้ว`
                  : `${m.subordinate_name || m.subordinate_username} accepted your invitation to join the team.`,
                time: m.responded_at,
                link: "/tasks?open=team",
                badge: {
                  label: th ? "เข้าร่วมทีม" : "Joined Team",
                  bg: "bg-emerald-100",
                  text: "text-emerald-800",
                },
                actions: [
                  {
                    label: th ? "ดูรายชื่อทีม" : "View Team",
                    actionType: "navigate",
                    link: "/tasks?open=team",
                    variant: "success",
                  },
                ],
                data: m,
              });
            } else if (m.status === "declined" && m.responded_at) {
              const id = `team-declined-${m.subordinate_public_id}-${m.responded_at}`;
              items.push({
                id,
                type: "task_rejected",
                title: th ? "สมาชิกปฏิเสธคำเชิญเข้าร่วมทีม" : "Team Invitation Declined",
                message: th
                  ? `คุณ ${m.subordinate_name || m.subordinate_username} (@${m.subordinate_username}) ปฏิเสธคำเชิญเข้าร่วมทีมสำรวจ`
                  : `${m.subordinate_name || m.subordinate_username} declined your invitation to join the team.`,
                time: m.responded_at,
                link: "/tasks?open=team",
                badge: {
                  label: th ? "ปฏิเสธ" : "Declined",
                  bg: "bg-rose-100",
                  text: "text-rose-800",
                },
                actions: [
                  {
                    label: th ? "ดูรายชื่อทีม" : "View Team",
                    actionType: "navigate",
                    link: "/tasks?open=team",
                    variant: "secondary",
                  },
                ],
                data: m,
              });
            }
          }
        } catch {}
      }

      // 3. Accountant Revision Requests (สำหรับหัวหน้างาน / Admin)
      if (isSup) {
        try {
          const requests = await fetchRevisionRequests("pending");
          for (const req of Array.isArray(requests) ? requests : []) {
            if (req && req.status === "pending") {
              const id = `req-${req.id || req.public_id}`;
              const typeTitle = req.request_type === "survey_new" ? (th ? "ขอสำรวจใหม่" : "New Survey") : (th ? "ขอแก้ไขข้อมูล" : "Revision");
              const targetName = req.target_type === "land" ? (th ? "แปลงที่ดิน" : "Land") : (th ? "สิ่งปลูกสร้าง" : "Building");
              items.push({
                id,
                type: "revision_request",
                title: th ? `คำร้องจากฝ่ายบัญชี (${typeTitle})` : `Accounting Request (${typeTitle})`,
                message: `${targetName} ${req.target_code || ""}: ${req.remarks || req.remark || (th ? "ตรวจสอบข้อมูลเพิ่มเติม" : "Please check")}`,
                time: req.created_at || new Date().toISOString(),
                link: "/tasks?open=requests",
                badge: {
                  label: th ? "คำร้องบัญชี" : "Accountant",
                  bg: "bg-amber-100",
                  text: "text-amber-800",
                },
                actions: [
                  {
                    label: th ? "ดูคำร้อง & สั่งงาน" : "Review & Assign",
                    actionType: "navigate",
                    link: "/tasks?open=requests",
                    variant: "amber",
                  },
                ],
                data: req,
              });
            }
          }
        } catch {}
      }

      // 3. Tasks Notifications
      try {
        const tasks = await fetchTasksList();
        for (const task of Array.isArray(tasks) ? tasks : []) {
          if (!task) continue;

          // 3.1 หัวหน้างาน: มีลูกน้องส่งผลสำรวจเข้ามา รอการอนุมัติ (Commit DB)
          if (isSup && task.status === "submitted") {
            const id = `task-sub-${task.public_id}-${task.updated_at || task.created_at}`;
            items.push({
              id,
              type: "submission_review",
              title: th ? "รออนุมัติผลการสำรวจภาคสนาม" : "Survey Result Pending Approval",
              message: `${task.title} — ส่งผลสำรวจโดย ${task.assignee_name || (th ? "เจ้าหน้าที่สำรวจ" : "Officer")}`,
              time: task.updated_at || task.created_at || new Date().toISOString(),
              link: `/tasks?review_task_id=${task.public_id}`,
              badge: {
                label: th ? "รอตรวจรับ" : "Pending Review",
                bg: "bg-purple-100",
                text: "text-purple-800",
              },
              actions: [
                {
                  label: th ? "ตรวจรับงาน & อนุมัติ" : "Review & Approve",
                  actionType: "navigate",
                  link: `/tasks?review_task_id=${task.public_id}`,
                  variant: "purple",
                },
              ],
              data: task,
            });
          }

          // 3.2 ลูกน้อง: ได้รับมอบหมายงานสำรวจใหม่ (status === 'pending')
          if (isOfficer && task.assignee_public_id === activeUser.public_id && task.status === "pending") {
            const id = `task-new-${task.public_id}`;
            items.push({
              id,
              type: "task_assigned",
              title: th ? "ได้รับมอบหมายภารกิจสำรวจใหม่" : "New Task Assigned",
              message: `${task.title} (สั่งโดย ${task.assigner_name || (th ? "หัวหน้างาน" : "Supervisor")})`,
              time: task.created_at || new Date().toISOString(),
              link: `/tasks?task_id=${task.public_id}`,
              badge: {
                label: th ? "งานใหม่" : "New Task",
                bg: "bg-sky-100",
                text: "text-sky-800",
              },
              actions: [
                {
                  label: th ? "ดูรายละเอียดงาน" : "View Task",
                  actionType: "navigate",
                  link: `/tasks?task_id=${task.public_id}`,
                  variant: "primary",
                },
              ],
              data: task,
            });
          }

          // 3.3 ลูกน้อง: งานถูกส่งกลับมาให้แก้ไข (revision_requested)
          if (isOfficer && task.assignee_public_id === activeUser.public_id && task.status === "revision_requested") {
            const id = `task-rev-${task.public_id}-${task.updated_at || task.created_at}`;
            items.push({
              id,
              type: "task_rejected",
              title: th ? "หัวหน้างานส่งกลับให้แก้ไขผลสำรวจ" : "Survey Revision Requested",
              message: `${task.title}${task.supervisor_feedback ? `: "${task.supervisor_feedback}"` : ""}`,
              time: task.updated_at || task.created_at || new Date().toISOString(),
              link: `/tasks?task_id=${task.public_id}`,
              badge: {
                label: th ? "ขอให้แก้ไข" : "Revision",
                bg: "bg-rose-100",
                text: "text-rose-800",
              },
              actions: [
                {
                  label: th ? "ดูข้อแก้ไขและส่งงานใหม่" : "Fix & Resubmit",
                  actionType: "navigate",
                  link: `/tasks?task_id=${task.public_id}`,
                  variant: "danger",
                },
              ],
              data: task,
            });
          }

          // 3.4 ลูกน้อง: ผลงานได้รับการอนุมัติสำเร็จแล้ว (done)
          if (isOfficer && task.assignee_public_id === activeUser.public_id && task.status === "done" && task.submission_data) {
            const id = `task-done-${task.public_id}-${task.updated_at || task.created_at}`;
            items.push({
              id,
              type: "task_approved",
              title: th ? "ผลการสำรวจได้รับการอนุมัติแล้ว" : "Survey Approved",
              message: `งาน "${task.title}" ได้รับการอนุมัติและบันทึกข้อมูลเข้าฐานข้อมูลระบบเรียบร้อยแล้ว`,
              time: task.updated_at || task.created_at || new Date().toISOString(),
              link: `/tasks?task_id=${task.public_id}`,
              badge: {
                label: th ? "อนุมัติแล้ว" : "Approved",
                bg: "bg-emerald-100",
                text: "text-emerald-800",
              },
              actions: [
                {
                  label: th ? "ดูสรุปผลงาน" : "View Details",
                  actionType: "navigate",
                  link: `/tasks?task_id=${task.public_id}`,
                  variant: "primary",
                },
              ],
              data: task,
            });
          }
        }
      } catch {}

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setNotifications(items);
    } finally {
      setLoading(false);
    }
  }, [user, th]);

  useEffect(() => {
    loadNotifications();

    const handleUpdate = () => loadNotifications();
    window.addEventListener("ams_data_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("focus", handleUpdate);

    const timer = setInterval(loadNotifications, 12000);

    return () => {
      window.removeEventListener("ams_data_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
      clearInterval(timer);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const dispatchNavigationEvent = (link: string) => {
    if (typeof window === "undefined") return;
    try {
      const u = new URL(link, window.location.origin);
      const taskId = u.searchParams.get("task_id");
      const reviewTaskId = u.searchParams.get("review_task_id");
      const openParam = u.searchParams.get("open");
      if (taskId) {
        window.dispatchEvent(new CustomEvent("ams_open_task", { detail: { taskId } }));
      }
      if (reviewTaskId) {
        window.dispatchEvent(new CustomEvent("ams_open_review", { detail: { reviewTaskId } }));
      }
      if (openParam) {
        window.dispatchEvent(new CustomEvent("ams_open_modal", { detail: { open: openParam } }));
      }
    } catch {}
  };

  const handleItemClick = (item: NotificationItem) => {
    markAsRead(item.id);
    setOpen(false);
    if (item.link) {
      router.push(item.link);
      dispatchNavigationEvent(item.link);
    }
  };

  const handleAction = async (e: React.MouseEvent, item: NotificationItem, action: NotificationAction) => {
    e.stopPropagation();
    markAsRead(item.id);

    if (action.actionType === "accept_invite" || action.actionType === "decline_invite") {
      setActionBusyId(item.id);
      try {
        const supId = item.data?.supervisor_public_id;
        const decision = action.actionType === "accept_invite" ? "accepted" : "declined";
        await respondToInvitation(supId, decision);
        await loadNotifications();
      } catch (err: any) {
        alert(err.message || (th ? "เกิดข้อผิดพลาด" : "Action failed"));
      } finally {
        setActionBusyId(null);
      }
      return;
    }

    if (action.actionType === "navigate" && action.link) {
      setOpen(false);
      router.push(action.link);
      dispatchNavigationEvent(action.link);
    }
  };

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;
  const filteredNotifications =
    activeFilter === "unread" ? notifications.filter((n) => !readIds.includes(n.id)) : notifications;

  const renderIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "invitation":
        return (
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Users size={16} />
          </div>
        );
      case "revision_request":
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
            <AlertCircle size={16} />
          </div>
        );
      case "submission_review":
        return (
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
            <FileCheck2 size={16} />
          </div>
        );
      case "task_assigned":
        return (
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 shadow-2xs">
            <ClipboardList size={16} />
          </div>
        );
      case "task_approved":
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCircle2 size={16} />
          </div>
        );
      case "task_rejected":
        return (
          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 shadow-2xs">
            <RotateCcw size={16} />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
            <Bell size={16} />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={th ? "การแจ้งเตือน" : "Notifications"}
        className={`relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition ${
          open
            ? theme === "dark"
              ? "bg-white/20 text-white shadow-inner"
              : "bg-govblue-50 text-govblue-800 shadow-inner"
            : theme === "dark"
            ? "text-blue-100 hover:text-white hover:bg-white/10"
            : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
        }`}
      >
        <Bell size={19} />

        {unreadCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs ring-2 ${
              theme === "dark" ? "ring-govblue-900" : "ring-white"
            } animate-in zoom-in-50`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Card */}
      {open && (
        <div className="absolute right-0 sm:right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-govblue-900 via-govblue-800 to-indigo-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={17} className="text-govblue-200" />
              <h3 className="font-bold text-sm tracking-tight">{th ? "การแจ้งเตือน" : "Notifications"}</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold bg-rose-500 text-white rounded-full shadow-2xs">
                  {unreadCount} {th ? "ใหม่" : "new"}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] text-govblue-200 hover:text-white flex items-center gap-1 font-medium transition cursor-pointer px-2 py-1 rounded-md hover:bg-white/10"
                title={th ? "ทำเครื่องหมายว่าอ่านทั้งหมด" : "Mark all as read"}
              >
                <CheckCheck size={14} />
                <span>{th ? "อ่านทั้งหมด" : "Mark read"}</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/70 px-3 pt-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`pb-2 px-2 font-semibold transition border-b-2 cursor-pointer ${
                activeFilter === "all"
                  ? "border-govblue-700 text-govblue-800"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {th ? "ทั้งหมด" : "All"} ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("unread")}
              className={`pb-2 px-2 font-semibold transition border-b-2 cursor-pointer ${
                activeFilter === "unread"
                  ? "border-govblue-700 text-govblue-800"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {th ? "ยังไม่อ่าน" : "Unread"} ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  <Inbox size={22} />
                </div>
                <div className="text-xs font-semibold text-gray-600">
                  {activeFilter === "unread"
                    ? th
                      ? "ไม่มีการแจ้งเตือนที่ยังไม่ได้อ่าน"
                      : "No unread notifications"
                    : th
                    ? "ไม่มีการแจ้งเตือนในขณะนี้"
                    : "No notifications right now"}
                </div>
                <p className="text-[11px] text-gray-400 max-w-[220px] mx-auto">
                  {th
                    ? "ระบบจะแจ้งเตือนอัตโนมัติเมื่อมีคำเชิญ คำร้องขอแก้ไข หรือภารกิจสำรวจใหม่เข้ามา"
                    : "You will be alerted when new team invitations, requests, or surveys arrive."}
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const isUnread = !readIds.includes(item.id);
                const isBusy = actionBusyId === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 transition cursor-pointer flex gap-3 items-start group ${
                      isUnread ? "bg-blue-50/40 hover:bg-blue-50/70" : "hover:bg-gray-50"
                    }`}
                  >
                    {renderIcon(item.type)}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${item.badge.bg} ${item.badge.text}`}
                          >
                            {item.badge.label}
                          </span>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="ยังไม่ได้อ่าน" />
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1 shrink-0">
                          <Clock size={10} />
                          {timeAgo(item.time, th ? "th" : "en")}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-gray-900 group-hover:text-govblue-800 transition line-clamp-1">
                        {item.title}
                      </div>

                      <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">{item.message}</p>

                      {/* Quick Actions */}
                      {item.actions && item.actions.length > 0 && (
                        <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                          {item.actions.map((act, actIdx) => {
                            let btnCls = "px-2.5 py-1 text-[11px] font-bold rounded-lg transition flex items-center gap-1 ";
                            if (act.variant === "success") {
                              btnCls += "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs";
                            } else if (act.variant === "danger") {
                              btnCls += "bg-rose-600 hover:bg-rose-700 text-white shadow-2xs";
                            } else if (act.variant === "purple") {
                              btnCls += "bg-purple-700 hover:bg-purple-800 text-white shadow-2xs";
                            } else if (act.variant === "amber") {
                              btnCls += "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs";
                            } else if (act.variant === "primary") {
                              btnCls += "bg-govblue-800 hover:bg-govblue-900 text-white shadow-2xs";
                            } else {
                              btnCls += "bg-gray-100 hover:bg-gray-200 text-gray-700";
                            }

                            return (
                              <button
                                key={actIdx}
                                type="button"
                                disabled={isBusy}
                                onClick={(e) => handleAction(e, item, act)}
                                className={btnCls}
                              >
                                {act.actionType === "accept_invite" && <Check size={12} />}
                                {act.actionType === "decline_invite" && <X size={12} />}
                                {act.actionType === "navigate" && <ExternalLink size={11} />}
                                <span>{isBusy ? (th ? "กำลังประมวลผล..." : "Processing...") : act.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-gray-50 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/tasks");
              }}
              className="text-xs font-semibold text-govblue-800 hover:text-govblue-900 inline-flex items-center gap-1 py-1 px-3 rounded-lg hover:bg-govblue-100/50 transition cursor-pointer"
            >
              <span>{th ? "ไปยังหน้าจัดการงานทั้งหมด" : "Go to Tasks Overview"}</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
