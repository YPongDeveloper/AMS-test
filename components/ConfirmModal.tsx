"use client";

import React, { useEffect } from "react";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "primary" | "success";
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "danger",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmModalProps) {
  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onCancel && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, isLoading]);

  if (!isOpen) return null;

  const toneConfig = {
    danger: {
      icon: AlertTriangle,
      iconBg: "bg-rose-50 text-rose-600 border-rose-100",
      confirmBtn: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 focus:ring-rose-500/30",
    },
    warning: {
      icon: AlertCircle,
      iconBg: "bg-amber-50 text-amber-600 border-amber-100",
      confirmBtn: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200 focus:ring-amber-500/30",
    },
    primary: {
      icon: Info,
      iconBg: "bg-govblue-50 text-govblue-700 border-govblue-100",
      confirmBtn: "bg-govblue-700 hover:bg-govblue-800 text-white shadow-blue-200 focus:ring-govblue-500/30",
    },
    success: {
      icon: CheckCircle2,
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100",
      confirmBtn: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 focus:ring-emerald-500/30",
    },
  }[tone];

  const IconComponent = toneConfig.icon;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative text-center transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        {onCancel && !isLoading && (
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        )}

        <div className={`w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center border shadow-inner ${toneConfig.iconBg}`}>
          <IconComponent className="w-7 h-7" />
        </div>

        <h3 id="confirm-modal-title" className="text-lg font-bold text-gray-900 leading-snug">
          {title}
        </h3>

        <div className="text-xs sm:text-sm text-gray-600 mt-2.5 leading-relaxed px-2">
          {message}
        </div>

        <div className="flex items-center gap-3 mt-6 pt-2">
          {onCancel && (
            <button
              type="button"
              disabled={isLoading}
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-semibold transition disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold shadow transition disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 ${toneConfig.confirmBtn}`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
