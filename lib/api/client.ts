import { ApiError, Envelope, TokenPair, AppUser } from "./types";
import {
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  saveTokens,
  clearTokens,
  saveCurrentUser,
  getCurrentUser,
} from "./storage";
import { encryptPayload, decryptPayload } from "./crypto";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
export const API_CONFIGURED = API_URL.length > 0;

let refreshing: Promise<boolean> | null = null;

// Auto-refresh access token with single-flight locking
export async function refreshTokens(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: encryptPayload({
            path: "/api/auth/refresh",
            method: "POST",
            body: { refresh_token: rt },
          }),
        }),
      });

      if (res.status === 401) {
        clearTokens();
        return false;
      }
      if (!res.ok) return false;

      const outer = await res.json();
      const env = (
        outer?.payload ? decryptPayload<Envelope<{ token: TokenPair; user: AppUser }>>(outer.payload) : outer
      ) as Envelope<{ token: TokenPair; user: AppUser }>;

      if (!env.data?.token) return false;
      saveTokens(env.data.token.access_token, env.data.token.refresh_token);
      if (env.data.user) saveCurrentUser(env.data.user);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown; skipAuthCheck?: boolean }
): Promise<T> {
  const isAuthEndpoint =
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/refresh") ||
    path === "/health";

  // Proactive Auth Verification
  if (!isAuthEndpoint && !init?.skipAuthCheck && typeof window !== "undefined") {
    const at = getAccessToken();
    const rt = getRefreshToken();
    const u = getCurrentUser();

    if (!at && !rt) {
      if (!u || (!u.public_id?.startsWith("mock-") && !u.public_id?.startsWith("u-"))) {
        clearTokens();
        window.location.href = "/?reason=unauthenticated";
        throw new ApiError("กรุณาเข้าสู่ระบบก่อนทำรายการ", 401);
      }
    } else if (isTokenExpired(at) && rt) {
      const ok = await refreshTokens();
      if (!ok && !getRefreshToken()) {
        clearTokens();
        window.location.href = "/?reason=session_expired";
        throw new ApiError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
      }
    }
  }

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const method = init?.method || (init?.json !== undefined ? "POST" : "GET");
    const body = init?.json !== undefined ? init.json : init?.body;

    // Send through BFF Gateway with encrypted payload (hiding URL & content in DevTools)
    const securePayload = encryptPayload({
      path,
      method,
      headers,
      body,
    });

    return fetch("/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: securePayload }),
    });
  };

  let res = await doFetch();

  // Retry once on 401
  if (res.status === 401 && getRefreshToken()) {
    const ok = await refreshTokens();
    if (ok) res = await doFetch();
  }

  if (res.status === 401) {
    clearTokens();
    if (typeof window !== "undefined" && !isAuthEndpoint) {
      window.location.href = "/?reason=session_expired";
    }
  }

  let rawData: any = null;
  try {
    const outer = await res.json();
    if (outer && typeof outer.payload === "string") {
      rawData = decryptPayload<Envelope<T>>(outer.payload);
    } else {
      rawData = outer;
    }
  } catch {
    rawData = null;
  }

  const env = rawData as Envelope<T> | null;
  if (!res.ok) {
    throw new ApiError(env?.message || `HTTP ${res.status}`, res.status);
  }

  return env?.data as T;
}
