"use client";

// useMe — bootstrap ตัวตนผู้ใช้กับ backend (LINE ID Token → /api/auth/line)
import { useCallback, useEffect, useState } from "react";
import { api, API_CONFIGURED, clearTokens, getAccessToken, loginWithLineIdToken, type AppUser } from "./api";
import { getLineIdToken, loginWithLiff } from "./liff";

export function useMe() {
  const [me, setMe] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(API_CONFIGURED);
  const [needLogin, setNeedLogin] = useState(false);
  const [authing, setAuthing] = useState(false);

  useEffect(() => {
    if (!API_CONFIGURED) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // 1) token เดิมยังใช้ได้ไหม
      if (getAccessToken()) {
        try {
          const u = await api<AppUser>("/api/me");
          if (!cancelled) {
            setMe(u);
            setLoading(false);
          }
          return;
        } catch {
          clearTokens();
        }
      }
      // 2) แลกจาก LINE ID Token (กรณีเปิดใน LIFF / login LINE ไว้แล้ว)
      const idToken = await getLineIdToken();
      if (idToken) {
        try {
          const user = await loginWithLineIdToken(idToken);
          if (!cancelled) {
            setMe(user);
            setLoading(false);
          }
          return;
        } catch {
          /* ไปหน้า need login */
        }
      }
      if (!cancelled) {
        setNeedLogin(true);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithLine = useCallback(async () => {
    setAuthing(true);
    const idToken = await getLineIdToken();
    if (!idToken) {
      await loginWithLiff(); // redirect ไปหน้า auth ของ LINE
      return;
    }
    try {
      const user = await loginWithLineIdToken(idToken);
      setMe(user);
      setNeedLogin(false);
    } catch {
      setNeedLogin(true);
    } finally {
      setAuthing(false);
    }
  }, []);

  return { me, setMe, loading, needLogin, authing, signInWithLine };
}
