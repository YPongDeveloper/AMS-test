"use client";

import { ReactNode } from "react";
import { Topbar } from "./Topbar";

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Topbar />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 text-xs text-gray-500 flex justify-between">
          <span>© 2569 {` `}การรถไฟแห่งประเทศไทย</span>
          <span>v0.1 (Mockup)</span>
        </div>
      </footer>
    </div>
  );
}
