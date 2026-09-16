import { Task, TaskSubmissionPayload, TeamMember } from "./types";
import { api, API_CONFIGURED } from "./client";
import { getCurrentUser, notifyDataUpdated } from "./storage";
import {
  getLocalTeam,
  saveLocalTeam,
  getLocalUsers,
  DEFAULT_MOCK_TEAM,
  TASK_STORAGE_KEY,
} from "./mockData";
import { createLand } from "./lands";
import { createBuilding } from "./buildings";

// ---- Team Management ----

export async function inviteToTeam(username: string): Promise<void> {
  const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
  if (!cleanUsername) return;

  const local = getLocalTeam();
  const existing = local.find(
    (m) => (m.subordinate_username || "").toLowerCase() === cleanUsername
  );
  if (existing) {
    if (existing.status === "accepted") {
      throw new Error(`@${cleanUsername} เป็นสมาชิกในสังกัดอยู่แล้ว ไม่สามารถส่งคำเชิญซ้ำได้`);
    } else if (existing.status === "pending") {
      throw new Error(`@${cleanUsername} มีคำเชิญอยู่แล้วและอยู่ระหว่างรอการตอบรับ`);
    }
  }

  if (API_CONFIGURED) {
    await api("/api/team/invite", { method: "POST", json: { username: cleanUsername } });
    notifyDataUpdated();
    return;
  }

  const all = [...local];
  const cur = getCurrentUser();
  const allUsers = getLocalUsers();
  const targetUser = allUsers.find(
    (u) => (u.username || "").toLowerCase() === cleanUsername
  );

  all.unshift({
    supervisor_public_id: cur?.public_id || "usr-leader",
    supervisor_name: cur?.display_name || "หัวหน้างานสำรวจ",
    supervisor_username: cur?.username || "leader",
    subordinate_public_id: targetUser?.public_id || "mock-" + cleanUsername,
    subordinate_name: targetUser?.display_name || (cleanUsername === "officer5" ? "นายกิตติศักดิ์ ช่างสำรวจอิสระ (รอย้ายเข้าสังกัด)" : cleanUsername),
    subordinate_username: cleanUsername,
    status: "pending",
    invited_at: new Date().toISOString(),
  });
  saveLocalTeam(all);
  notifyDataUpdated();
}

export async function fetchMyTeam(): Promise<TeamMember[]> {
  if (!API_CONFIGURED) {
    const local = getLocalTeam();
    return Array.isArray(local) ? local : [];
  }
  try {
    const res = await api<TeamMember[]>("/api/team/members");
    const list = Array.isArray(res) ? res : [];
    if (list.filter((m) => m && m.status === "accepted").length < 4) {
      const merged = [...list];
      for (const m of DEFAULT_MOCK_TEAM) {
        if (!merged.some((x) => x.subordinate_username === m.subordinate_username)) {
          merged.push(m);
        }
      }
      return merged;
    }
    return list;
  } catch {
    const local = getLocalTeam();
    return Array.isArray(local) ? local : [];
  }
}

export async function fetchMyInvitations(): Promise<TeamMember[]> {
  if (!API_CONFIGURED) {
    const cur = getCurrentUser();
    const local = getLocalTeam();
    const arr = Array.isArray(local) ? local : [];
    return arr.filter(
      (m) =>
        m &&
        m.status === "pending" &&
        (
          !cur ||
          cur.role === "subordinate" ||
          (m.subordinate_username && cur.username && m.subordinate_username.toLowerCase() === cur.username.toLowerCase()) ||
          (m.subordinate_public_id && cur.public_id && m.subordinate_public_id === cur.public_id)
        )
    );
  }
  try {
    const res = await api<TeamMember[]>("/api/team/invitations");
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function respondToInvitation(supervisorPublicId: string, action: "accepted" | "declined"): Promise<void> {
  if (!API_CONFIGURED) {
    const local = getLocalTeam();
    const all = Array.isArray(local) ? [...local] : [];
    const cur = getCurrentUser();
    const item = all.find(
      (m) =>
        m &&
        (m.supervisor_public_id === supervisorPublicId || !supervisorPublicId) &&
        (
          !cur ||
          cur.role === "subordinate" ||
          (m.subordinate_username && cur.username && m.subordinate_username.toLowerCase() === cur.username.toLowerCase()) ||
          (m.subordinate_public_id && cur.public_id && m.subordinate_public_id === cur.public_id)
        )
    );
    if (item) {
      item.status = action;
      item.responded_at = new Date().toISOString();
      saveLocalTeam(all);
    }
    notifyDataUpdated();
    return;
  }
  await api("/api/team/respond", {
    method: "POST",
    json: { supervisor_public_id: supervisorPublicId, action },
  });
  notifyDataUpdated();
}

export async function removeTeamMember(subordinatePublicId: string): Promise<void> {
  if (!API_CONFIGURED) {
    const local = getLocalTeam();
    const all = (Array.isArray(local) ? local : []).filter((m) => m && m.subordinate_public_id !== subordinatePublicId);
    saveLocalTeam(all);
    notifyDataUpdated();
    return;
  }
  await api(`/api/team/${subordinatePublicId}`, { method: "DELETE" });
  notifyDataUpdated();
}

// ---- Task Operations ----

export async function submitTaskData(
  taskPublicId: string,
  data: TaskSubmissionPayload
): Promise<Task> {
  if (!API_CONFIGURED) {
    const saved = typeof window !== "undefined" ? (window.localStorage.getItem(TASK_STORAGE_KEY) || window.localStorage.getItem("ams_saved_tasks_v5")) : null;
    let list: Task[] = saved ? JSON.parse(saved) : [];
    const idx = list.findIndex((t) => t.public_id === taskPublicId);
    if (idx >= 0) {
      list[idx].status = "submitted";
      list[idx].submission_data = data;
      if (data.address) list[idx].address = data.address;
      if (data.lat != null) list[idx].lat = data.lat;
      if (data.lng != null) list[idx].lng = data.lng;
      list[idx].updated_at = new Date().toISOString();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(list));
      }
      notifyDataUpdated();
      return list[idx];
    }
    throw new Error("ไม่พบงาน");
  }
  const res = await api<Task>(`/api/tasks/${taskPublicId}/submit`, {
    method: "POST",
    json: { data },
  });
  notifyDataUpdated();
  return res;
}

export async function reviewTask(
  taskPublicId: string,
  action: "approve" | "reject",
  feedback?: string
): Promise<Task> {
  if (!API_CONFIGURED) {
    const saved = typeof window !== "undefined" ? (window.localStorage.getItem(TASK_STORAGE_KEY) || window.localStorage.getItem("ams_saved_tasks_v5")) : null;
    let list: Task[] = saved ? JSON.parse(saved) : [];
    const idx = list.findIndex((t) => t.public_id === taskPublicId);
    if (idx >= 0) {
      const task = list[idx];
      if (action === "approve") {
        task.status = "done";
        if (task.submission_data) {
          try {
            const parsed = typeof task.submission_data === "string" ? JSON.parse(task.submission_data) : task.submission_data;
            if (Array.isArray(parsed.lands)) {
              for (const l of parsed.lands) {
                if (l.land_code) createLand(l);
              }
            }
            if (Array.isArray(parsed.buildings)) {
              for (const b of parsed.buildings) {
                if (b.bldg_code) createBuilding(b);
              }
            }
            if (Array.isArray(parsed.items)) {
              if (task.target_type === "building") {
                for (const b of parsed.items) if (b.bldg_code) createBuilding(b);
              } else {
                for (const l of parsed.items) if (l.land_code) createLand(l);
              }
            }
          } catch {}
        }
      } else {
        task.status = "revision_requested";
        task.supervisor_feedback = feedback || null;
      }
      task.updated_at = new Date().toISOString();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(list));
      }
      notifyDataUpdated();
      return task;
    }
    throw new Error("ไม่พบงาน");
  }
  const res = await api<Task>(`/api/tasks/${taskPublicId}/review`, {
    method: "POST",
    json: { action, feedback },
  });
  notifyDataUpdated();
  return res;
}

export async function fetchTasksList(): Promise<Task[]> {
  let serverTasks: Task[] = [];
  if (API_CONFIGURED) {
    try {
      const res = await api<Task[]>("/api/tasks");
      if (Array.isArray(res)) serverTasks = res;
    } catch {}
  }

  let localTasks: Task[] = [];
  if (typeof window !== "undefined") {
    const cached =
      window.localStorage.getItem(TASK_STORAGE_KEY) ||
      window.localStorage.getItem("ams_saved_tasks_v6") ||
      window.localStorage.getItem("ams_saved_tasks_v5");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          localTasks = parsed.filter((t) => t && typeof t === "object" && t.public_id);
        }
      } catch {}
    }
  }

  const taskMap = new Map<string, Task>();
  for (const t of serverTasks) {
    if (t && t.public_id) {
      taskMap.set(t.public_id, t);
      if (t.code) taskMap.set(t.code, t);
    }
  }
  for (const t of localTasks) {
    if (t && t.public_id) {
      const existing = taskMap.get(t.public_id) || (t.code ? taskMap.get(t.code) : null);
      if (
        !existing ||
        t.status === "done" ||
        (t.updated_at && (!existing.updated_at || t.updated_at >= existing.updated_at))
      ) {
        taskMap.set(t.public_id, t);
        if (t.code) taskMap.set(t.code, t);
      }
    }
  }

  return Array.from(new Set(taskMap.values()));
}
