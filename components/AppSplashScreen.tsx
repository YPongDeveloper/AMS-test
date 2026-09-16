"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";

export function AppSplashScreen() {
  const [mounted, setMounted] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // แสดงโลโก้ประมาณ 1 วินาที จากนั้นค่อยๆ Fade out
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1000);

    const unmountTimer = setTimeout(() => {
      setMounted(false);
    }, 1450);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#0f2052] select-none transition-opacity duration-400 ease-out ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        {/* Animated Train Logo Container */}
        <div className="relative">
          {/* Glowing Aura Ring */}
          <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-govgold-500/25 via-govgold-400/35 to-blue-400/25 blur-md animate-pulse" />
          
          {/* Circular Badge with Train Logo */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex items-center justify-center p-4 animate-splash-logo">
            <Logo className="w-full h-full text-govgold-400 drop-shadow-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
