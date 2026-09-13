"use client";

// usePwaInstall — ตรวจว่าติดตั้ง PWA เป็นแอปได้หรือไม่ (เฉพาะมือถือ)
import { useCallback, useEffect, useState } from "react";

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setInstalled(standalone);
      const mobile =
        window.matchMedia("(max-width: 767px)").matches ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    check();
    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "manual"> => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return outcome;
    }
    return "manual"; // iOS — ต้องติดตั้งผ่านปุ่มแชร์เอง
  }, [deferred]);

  // แสดงเมนูติดตั้ง: อยู่บนมือถือ + ยังไม่ได้ติดตั้ง
  return { canInstall: isMobile && !installed, isMobile, installed, promptInstall };
}
