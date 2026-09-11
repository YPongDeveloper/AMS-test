"use client";

import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-md border border-gray-200 shadow-sm ${className}`}>{children}</div>
  );
}

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg sm:text-xl font-semibold text-govblue-700">{title}</h2>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "blue",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "blue" | "gold" | "green" | "red" | "amber";
}) {
  const tones: Record<string, string> = {
    blue: "from-govblue-700 to-govblue-600",
    gold: "from-govgold-500 to-amber-600",
    green: "from-emerald-700 to-emerald-600",
    red: "from-rose-700 to-rose-600",
    amber: "from-amber-600 to-orange-600",
  };
  return (
    <div className={`rounded-md p-3 sm:p-4 text-white shadow bg-gradient-to-br ${tones[tone]}`}>
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wider opacity-80 leading-tight">{label}</div>
      <div className="text-lg sm:text-2xl font-bold leading-tight mt-1 break-words">{value}</div>
      {hint && <div className="text-[10px] sm:text-[11px] opacity-80 mt-0.5 sm:mt-1 leading-tight">{hint}</div>}
    </div>
  );
}

export function Field({
  label,
  children,
  required = false,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="text-xs font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </div>
      {children}
      {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-govblue-500/30 focus:border-govblue-500 ${
        props.className ?? ""
      }`}
    />
  );
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-govblue-500/30 focus:border-govblue-500 ${
        props.className ?? ""
      }`}
    >
      {children}
    </select>
  );
}

export function Btn({
  children,
  variant = "primary",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles: Record<string, string> = {
    primary: "bg-govblue-700 hover:bg-govblue-600 text-white",
    secondary: "bg-white hover:bg-gray-50 text-govblue-700 border border-govblue-700",
    danger: "bg-rose-600 hover:bg-rose-500 text-white",
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded transition ${
        styles[variant]
      } ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Tag({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "gold" | "green" | "red" | "gray";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    gold: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    gray: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded border ${tones[tone]}`}>
      {children}
    </span>
  );
}
