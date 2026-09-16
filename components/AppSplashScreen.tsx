"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";

export function AppSplashScreen() {
  const [mounted, setMounted] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // แสดงโลโก้และอนิเมชั่นรถไฟประมาณ 1 วินาที จากนั้นค่อยๆ Fade out อย่างนุ่มนวล
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1100);

    const unmountTimer = setTimeout(() => {
      setMounted(false);
    }, 1550);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#0f2052] select-none transition-opacity duration-450 ease-out ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.5)_0%,rgba(15,32,82,1)_70%)]" />

      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        {/* Animated Train Logo Container */}
        <div className="relative mb-6">
          {/* Glowing Aura Ring */}
          <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-govgold-500/20 via-govgold-400/30 to-blue-400/20 blur-md animate-pulse" />
          
          {/* Circular Badge with Logo */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex items-center justify-center p-4 animate-splash-logo">
            <Logo className="w-full h-full text-govgold-400 drop-shadow-md" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-500">
          <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-wide">
            ระบบจัดการคำนวนภาษี
          </h1>
          <p className="text-xs sm:text-sm text-govblue-200/90 font-medium">
            การรถไฟแห่งประเทศไทย
          </p>
        </div>

        {/* Smooth Indeterminate Progress / Train Track Line */}
        <div className="mt-8 w-40 h-1 bg-white/15 rounded-full overflow-hidden relative">
          <div className="absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-govgold-400 to-transparent rounded-full animate-splash-track" />
        </div>
      </div>
    </div>
  );
}
