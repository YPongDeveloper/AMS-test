"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "./Topbar";
import { getCurrentUser, hasValidSession, type Role } from "@/lib/api";
import { ShieldAlert, LogIn, ArrowLeft } from "lucide-react";

interface PageProps {
  children: ReactNode;
  allowedRoles?: Role[];
}

export function Page({ children, allowedRoles }: PageProps) {
  const [mounted, setMounted] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<"no_session" | "forbidden" | null>(null);

  useEffect(() => {
    setMounted(true);
    // 1. ตรวจสอบว่ามีการล็อกอินและเซสชันถูกต้องหรือไม่
    if (!hasValidSession()) {
      setAuthorized(false);
      setAuthError("no_session");
      return;
    }

    // 2. ตรวจสอบสิทธิ์ Role ตาม Broken Access Control
    if (allowedRoles && allowedRoles.length > 0) {
      const u = getCurrentUser();
      if (!u || !allowedRoles.includes(u.role)) {
        setAuthorized(false);
        setAuthError("forbidden");
        return;
      }
    }

    setAuthorized(true);
  }, [allowedRoles]);

  if (!mounted || authorized === null) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/50">
        <Topbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="animate-pulse text-xs text-gray-400">กำลังตรวจสอบสิทธิ์ความปลอดภัย...</div>
        </main>
      </div>
    );
  }

  // กรณีไม่มีสิทธิ์เข้าถึง (Broken Access Control Protection)
  if (authorized === false) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/50">
        <Topbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 sm:p-8 border border-rose-200 shadow-lg text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 shadow-xs">
              <ShieldAlert size={28} />
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {authError === "no_session" ? "กรุณาเข้าสู่ระบบก่อนใช้งาน" : "ไม่มีสิทธิ์เข้าถึงหน้านี้"}
              </h2>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                {authError === "no_session"
                  ? "ระบบความปลอดภัยตรวจไม่พบเซสชันการเข้าสู่ระบบที่ถูกต้อง (Session Expired or Missing Token) กรุณาเข้าสู่ระบบใหม่อีกครั้ง"
                  : "บทบาทปัจจุบันของคุณไม่ได้รับอนุญาตให้เปิดใช้งานหน้านี้ตามนโยบายควบคุมการเข้าถึง (Broken Access Control Protected)"}
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              {authError === "no_session" ? (
                <Link
                  href="/?reason=unauthenticated"
                  className="w-full bg-govblue-800 hover:bg-govblue-900 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <LogIn size={15} /> ไปหน้าเข้าสู่ระบบ
                </Link>
              ) : (
                (() => {
                  const u = getCurrentUser();
                  const homeHref =
                    u?.role === "accountant"
                      ? "/land"
                      : u?.role === "subordinate"
                        ? "/tasks"
                        : "/dashboard";
                  return (
                    <Link
                      href={homeHref}
                      className="w-full bg-govblue-800 hover:bg-govblue-900 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <ArrowLeft size={15} /> กลับสู่หน้าหลักของคุณ
                    </Link>
                  );
                })()
              )}
            </div>
          </div>
        </main>
        <footer className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-3 sm:px-6 py-3 text-xs text-gray-500">
            © 2569 การรถไฟแห่งประเทศไทย
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Topbar />
      <main className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-6">{children}</main>
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 py-3 text-xs text-gray-500">
          © 2569 การรถไฟแห่งประเทศไทย
        </div>
      </footer>
    </div>
  );
}
