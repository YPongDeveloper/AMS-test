"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { getCurrentUser } from "@/lib/api";
import { getRoleHomeHref } from "@/components/Page";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // บันทึกข้อผิดพลาดลง Console เพื่อการตรวจสอบ
    console.error("Application error caught by ErrorBoundary:", error);
  }, [error]);

  const user = getCurrentUser();
  const homeHref = getRoleHomeHref(user?.role);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-xs">
          <AlertTriangle size={28} />
        </div>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">
            ระบบตรวจพบข้อผิดพลาดในการแสดงผล
          </h2>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            เกิดข้อผิดพลาดชั่วคราวในการประมวลผลข้อมูลหน้าจอ ท่านสามารถกดปุ่มลองใหม่อีกครั้ง หรือกลับสู่หน้าหลักของคุณ
          </p>
        </div>

        {error?.message && (
          <div className="p-2.5 bg-slate-100 rounded-lg text-[11px] font-mono text-slate-700 text-left overflow-x-auto max-h-24">
            {error.message}
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 bg-govblue-800 hover:bg-govblue-900 active:scale-95 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
          >
            <RotateCcw size={15} /> ลองใหม่อีกครั้ง
          </button>
          <Link
            href={homeHref}
            className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition border border-slate-200"
          >
            <Home size={15} /> กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </div>
  );
}
