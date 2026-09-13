"use client";

// useMe — bootstrap ตัวตนผู้ใช้กับ backend (LINE ID Token → /api/auth/line)
// หลักการ: ถ้าอยู่ใน LIFF (เปิดผ่าน LINE) ตัวตนมีอยู่แล้ว — ห้ามพาไปหน้า login ซ้ำ
// Render ฟรีจะหลับเมื่อไม่มี traffic → แลก token อาจโดน 502 ชั่วคราว → retry ให้เอง

import { useCallback, useEffect, useState } from "react";
import {
  api,
  API_CONFIGURED,
  ApiError,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  loginWithLineIdToken,
  type AppUser,
} from "./api";
import { getLineIdToken, loginWithLiff } from "./liff";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// authenticateWithLine — ใช้ LINE session (LIFF) แลกเป็นบัญชีระบบ (retry รอ server ตื่น)
// ใช้ทั้งจาก useMe bootstrap และหน้า login; throw ถ้าไม่สำเร็จ
export async function authenticateWithLine(): Promise<AppUser> {
  const idToken = await getLineIdToken();
  if (!idToken) throw new Error("no line session");
  return exchangeIdToken(idToken);
}

async function exchangeIdToken(idToken: string): Promise<AppUser> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await loginWithLineIdToken(idToken);
    } catch (e) {
      lastErr = e;
      // 400/401 = token/config มีปัญหาจริง ไม่ต้องรอ
      if (e instanceof ApiError && (e.status === 400 || e.status === 401)) throw e;
      // 502/503/timeout = server กำลังตื่น — รอแล้วลองใหม่
      await delay(2000 + attempt * 2500);
    }
  }
  throw lastErr ?? new Error("server unavailable");
}

export function useMe() {
  const [me, setMe] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(API_CONFIGURED);
  const [needLogin, setNeedLogin] = useState(false); // ไม่มีตัวตน LINE → แสดงปุ่ม login
  const [serverDown, setServerDown] = useState(false); // มีตัวตน LINE แล้ว แต่ backend ยังหลับ
  const [authing, setAuthing] = useState(false);

  const bootstrap = useCallback(async () => {
    if (!API_CONFIGURED) {
      setLoading(false);
      return;
    }
    // 1) access token เดิม (api() จะ auto-refresh ด้วย refresh token ให้เอง)
    if (getAccessToken()) {
      try {
        setMe(await api<AppUser>("/api/me"));
        setLoading(false);
        return;
      } catch {
        clearTokens();
        if (getAccessToken()) {
          try {
            setMe(await api<AppUser>("/api/me"));
            setLoading(false);
            return;
          } catch {
            clearTokens();
          }
        }
      }
    }
    // 2) ใน LIFF: ตัวตน LINE มีอยู่แล้ว — แลกเป็นบัญชีระบบเลย ไม่ต้อง login ซ้ำ
    try {
      setMe(await authenticateWithLine());
      setLoading(false);
      return;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 400 || e.status === 401)) {
        setNeedLogin(true); // LINE session หมดจริง — ให้กดปุ่มเพื่อ login ใหม่
        setLoading(false);
        return;
      }
      setServerDown(true); // backend ยังหลับ — แสดงปุ่ม retry
      setLoading(false);
      return;
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signInWithLine = useCallback(async () => {
    setAuthing(true);
    try {
      const idToken = await getLineIdToken();
      if (!idToken) {
        await loginWithLiff(); // redirect ไปหน้า auth ของ LINE (เฉพาะเมื่อไม่มี session จริง ๆ)
        return;
      }
      const user = await exchangeIdToken(idToken);
      setMe(user);
      setNeedLogin(false);
      setServerDown(false);
    } catch {
      setServerDown(true);
    } finally {
      setAuthing(false);
    }
  }, []);

  const retry = useCallback(async () => {
    setLoading(true);
    setServerDown(false);
    await bootstrap();
  }, [bootstrap]);

  return { me, setMe, loading, needLogin, serverDown, authing, signInWithLine, retry };
}
