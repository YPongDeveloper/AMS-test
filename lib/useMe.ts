"use client";

import { useCallback, useEffect, useState } from "react";
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

  const bootstrap = useCallback(async () => {
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
    } catch (e) {
      const msg = (e as Error).message || "";
      if (msg.includes("401") || msg.includes("unauthorized")) {
        clearTokens();
        setNeedLogin(true);
      } else {
        setServerDown(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const retry = useCallback(async () => {
    setLoading(true);
    setServerDown(false);
    await bootstrap();
  }, [bootstrap]);

  return { me, setMe, loading, needLogin, serverDown, retry };
}
