import { AppUser, Role } from "./types";
import { api, API_CONFIGURED } from "./client";
import { getLocalUsers, saveLocalUsers, DEFAULT_MOCK_USERS } from "./mockData";

export async function fetchUsers(role?: string): Promise<AppUser[]> {
  if (!API_CONFIGURED) {
    const all = getLocalUsers();
    return role ? all.filter((u) => u.role === role) : all;
  }
  try {
    const serverUsers = await api<AppUser[]>(role ? `/api/users?role=${encodeURIComponent(role)}` : "/api/users");
    const merged = Array.isArray(serverUsers) ? [...serverUsers] : [];
    for (const u of DEFAULT_MOCK_USERS) {
      if (!merged.some((m) => m.username === u.username)) {
        merged.push(u);
      }
    }
    return role ? merged.filter((u) => u.role === role) : merged;
  } catch {
    const all = getLocalUsers();
    return role ? all.filter((u) => u.role === role) : all;
  }
}

export async function createUser(data: {
  username: string;
  password: string;
  display_name: string;
  role: Role;
}): Promise<AppUser> {
  if (!API_CONFIGURED) {
    const all = getLocalUsers();
    const newUser: AppUser = {
      public_id: "u-" + Date.now(),
      username: data.username,
      display_name: data.display_name,
      picture_url: null,
      role: data.role,
      status: "active",
      created_at: new Date().toISOString(),
    };
    all.unshift(newUser);
    saveLocalUsers(all);
    return newUser;
  }
  return api<AppUser>("/api/users", { method: "POST", json: data });
}

export async function updateUser(
  public_id: string,
  data: { display_name: string; role: Role; status: "active" | "resigned" }
): Promise<void> {
  if (!API_CONFIGURED) {
    const all = getLocalUsers();
    const idx = all.findIndex((u) => u.public_id === public_id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...data };
      saveLocalUsers(all);
    }
    return;
  }
  await api(`/api/users/${encodeURIComponent(public_id)}`, { method: "PUT", json: data });
}

export async function resetUserPassword(public_id: string, password: string): Promise<void> {
  if (!API_CONFIGURED) return;
  await api(`/api/users/${encodeURIComponent(public_id)}/password`, { method: "POST", json: { password } });
}

export async function setUserStatus(public_id: string, status: "active" | "resigned"): Promise<void> {
  if (!API_CONFIGURED) {
    const all = getLocalUsers();
    const idx = all.findIndex((u) => u.public_id === public_id);
    if (idx >= 0) {
      all[idx].status = status;
      saveLocalUsers(all);
    }
    return;
  }
  await api(`/api/users/${encodeURIComponent(public_id)}/status`, { method: "PATCH", json: { status } });
}
