import { AppUser, Role, TokenPair } from "./types";
import { api, API_CONFIGURED, API_URL, refreshTokens } from "./client";
import {
  saveTokens,
  saveCurrentUser,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  ISSUED_KEY,
} from "./storage";

export async function loginWithPassword(username: string, password: string): Promise<AppUser> {
  const data = await api<{ user: AppUser; token: TokenPair }>("/api/auth/login", {
    method: "POST",
    json: { username, password },
  });
  if (data?.token) saveTokens(data.token.access_token, data.token.refresh_token);
  saveCurrentUser(data.user);
  return data.user;
}

export function loginDemo(role: Role = "supervisor"): AppUser {
  const mockUser: AppUser = {
    public_id:
      role === "admin"
        ? "u-admin"
        : role === "supervisor"
        ? "usr-leader"
        : role === "accountant"
        ? "u-acc"
        : "usr-normal",
    username:
      role === "admin"
        ? "admin"
        : role === "supervisor"
        ? "leader"
        : role === "accountant"
        ? "accountant"
        : "normal",
    display_name:
      role === "admin"
        ? "ผู้ดูแลระบบสูงสุด"
        : role === "supervisor"
        ? "หัวหน้างานสำรวจ"
        : role === "accountant"
        ? "พนักงานบัญชีและการเงิน"
        : "นายสมศักดิ์ สำรวจดี (เจ้าหน้าที่สำรวจ 1)",
    picture_url: null,
    role,
    status: "active",
    created_at: new Date().toISOString(),
  };
  saveCurrentUser(mockUser);
  return mockUser;
}

export async function logout() {
  const rt = getRefreshToken();
  if (rt && API_CONFIGURED) {
    try {
      await api("/api/auth/logout", { method: "POST", json: { refresh_token: rt } });
    } catch {
      /* ignore */
    }
  }
  clearTokens();
}

export async function fetchMe(): Promise<AppUser> {
  const user = await api<AppUser>("/api/me");
  saveCurrentUser(user);
  return user;
}

export function wsUrl(): string | null {
  if (!API_CONFIGURED) return null;
  return API_URL.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(getAccessToken() || "");
}

export async function ensureFreshAccessToken(): Promise<void> {
  if (!API_CONFIGURED || !getRefreshToken()) return;
  const issued = Number(window.localStorage.getItem(ISSUED_KEY) || 0);
  const ageMin = (Date.now() - issued) / 60000;
  if (issued > 0 && ageMin < 13 && getAccessToken()) return;
  await refreshTokens();
}
