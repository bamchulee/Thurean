"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * หน้าต่างแบบ "แผ่นเลื่อนขึ้นจากล่าง" บนมือถือ และกล่องกลางจอบนจอใหญ่
 * ส่วนหัว/ปุ่มท้ายติดอยู่กับที่ เนื้อหาตรงกลางเลื่อนได้ — ไม่ล้นจอทุกขนาด
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`sheet-in w-full ${size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92dvh] sm:max-h-[88dvh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 flex items-center justify-between gap-2 px-4 pt-2.5 pb-2 border-b border-stone-100">
          <span className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-stone-200" />
          <div className="min-w-0 pt-1 text-sm font-bold text-stone-900 truncate">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="shrink-0 -mr-1.5 mt-0.5 p-1.5 rounded-full text-stone-500 hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-stone-100 bg-white px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
