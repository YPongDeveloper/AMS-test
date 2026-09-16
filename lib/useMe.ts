"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  api,
  API_CONFIGURED,
  clearTokens,
  getAccessToken,
  getCurrentUser,
  type AppUser,
} from "./api";

export function useMe() {
  const [me, setMe] = useState<AppUser | null>(() => getCurrentUser());
  const [loading, setLoading] = useState(API_CONFIGURED && !getCurrentUser());
  const [needLogin, setNeedLogin] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const bootstrap = useCallback(async (isRetry = false) => {
    if (!API_CONFIGURED) {
      setLoading(false);
      return;
    }

    if (!getAccessToken()) {
      setNeedLogin(true);
      setLoading(false);
      return;
    }

    try {
      const user = await api<AppUser>("/api/me");
      setMe(user);
      setNeedLogin(false);
      setServerDown(false);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    } catch (e) {
      const msg = (e as Error).message || "";
      if (msg.includes("401") || msg.includes("unauthorized")) {
        clearTokens();
        setNeedLogin(true);
      } else {
        setServerDown(true);
        // Automatic background retry if server is waking up (e.g. Render cold start)
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          bootstrap(true);
        }, 5000);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [bootstrap]);

  // Keep-alive heartbeat ping every 10 minutes while page is open to prevent Render sleep
  useEffect(() => {
    if (!API_CONFIGURED) return;
    const interval = setInterval(() => {
      api<{ status: string }>("/health", { skipAuthCheck: true }).catch(() => {});
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const retry = useCallback(async () => {
    setLoading(true);
    setServerDown(false);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    await bootstrap();
  }, [bootstrap]);

  return { me, setMe, loading, needLogin, serverDown, retry };
}
