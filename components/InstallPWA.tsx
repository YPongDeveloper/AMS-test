"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, Smartphone, Check } from "lucide-react";
import Logo from "./Logo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    // Already installed?
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    // iOS?
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) setShowIOSHint(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm flex items-center gap-2 max-w-xs">
        <Check size={16} />
        <span>ติดตั้งแอปแล้ว ✓</span>
      </div>
    );
  }

  // No install prompt available and not iOS
  if (!deferred && !showIOSHint) return null;

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  return (
    <>
      {showIntro && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 max-w-sm animate-in">
          <div className="bg-white border border-gray-200 rounded-lg shadow-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-govblue-700 to-govblue-600 flex items-center justify-center flex-shrink-0">
                <Logo className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-govblue-700 text-sm">ติดตั้งเป็นแอป PWA</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  เพิ่มลงหน้าจอหลัก ใช้งานได้แม้ไม่มีอินเทอร์เน็ต
                </div>
                <div className="flex gap-2 mt-3">
                  {deferred ? (
                    <button
                      onClick={handleInstall}
                      className="flex-1 bg-govblue-700 hover:bg-govblue-600 text-white text-xs font-medium py-2 rounded flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} /> ติดตั้ง
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowIntro(false);
                        setShowIOSHint(true);
                      }}
                      className="flex-1 bg-govblue-700 hover:bg-govblue-600 text-white text-xs font-medium py-2 rounded flex items-center justify-center gap-1.5"
                    >
                      <Smartphone size={14} /> วิธีติดตั้ง
                    </button>
                  )}
                  <button
                    onClick={() => setShowIntro(false)}
                    className="px-3 text-gray-400 hover:text-gray-600"
                    aria-label="ปิด"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIOSHint && !showIntro && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowIOSHint(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-govblue-700">ติดตั้งบน iPhone / iPad</h3>
              <button onClick={() => setShowIOSHint(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-govblue-700 text-white text-xs font-bold flex items-center justify-center">1</span>
                <span>กดปุ่ม <Share className="inline" size={14} /> <b>แชร์</b> ที่แถบเครื่องมือด้านล่าง</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-govblue-700 text-white text-xs font-bold flex items-center justify-center">2</span                >
                <span>เลือก <b>"เพิ่มในหน้าจอโฮม"</b> (Add to Home Screen)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-govblue-700 text-white text-xs font-bold flex items-center justify-center">3</span>
                <span>กด <b>"เพิ่ม"</b> เพื่อยืนยัน</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSHint(false)}
              className="w-full mt-4 bg-govblue-700 text-white py-2 rounded text-sm font-medium"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}
    </>
  );
}
