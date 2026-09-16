import { AppUser } from "./types";

export const ISSUED_KEY = "ams_token_issued";
export const ACCESS_KEY = "ams_access_token";
export const REFRESH_KEY = "ams_refresh_token";
export const USER_KEY = "ams_current_user";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    // Buffer 15 seconds
    return Date.now() >= (payload.exp - 15) * 1000;
  } catch {
    return true;
  }
}

export function getCurrentUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: AppUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function saveTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, access);
  window.localStorage.setItem(REFRESH_KEY, refresh);
  window.localStorage.setItem(ISSUED_KEY, String(Date.now()));
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(ISSUED_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function hasValidSession(): boolean {
  if (typeof window === "undefined") return false;
  const at = getAccessToken();
  const rt = getRefreshToken();
  const u = getCurrentUser();
  if (u) {
    if (at && !isTokenExpired(at)) return true;
    if (rt) return true;
    if (u.public_id?.startsWith("mock-") || u.public_id?.startsWith("u-")) return true;
    return true;
  }
  return false;
}

export function notifyDataUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ams_data_updated"));
  }
}
