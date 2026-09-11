"use client";

import { ReactNode } from "react";
import { Topbar } from "./Topbar";

export function Page({ children }: { children: ReactNode }) {
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
